import sys
import json
import hashlib
import importlib
from pathlib import Path
from urllib.parse import quote

PYTHON_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PYTHON_ROOT))

# This runs before backend imports, even when Streamlit retains old modules.
# Treat the backend as one version so functions and Pydantic classes agree.
backend_revision = hashlib.sha256()
for source in sorted((PYTHON_ROOT / 'workbench').glob('*.py')):
    backend_revision.update(source.name.encode())
    backend_revision.update(source.read_bytes())
revision = backend_revision.hexdigest()
package = sys.modules.get('workbench')
if package is not None and getattr(package, '__workbench_revision__', None) != revision:
    importlib.invalidate_caches()
    for name in list(sys.modules):
        if name == 'workbench' or name.startswith('workbench.'):
            del sys.modules[name]
import streamlit as st
from workbench.models import Project, Word, load, save
from workbench.vocabulary import validate_vocabulary
from workbench.songs import import_song, ingest, export_ts, warnings, dictionary, ROOT
from workbench.generation import generate
from workbench.transport import GeminiTransport
from workbench.generation_plan import plan_generation, LABELS, GenerationReport

sys.modules['workbench'].__dict__['__workbench_revision__'] = revision

st.set_page_config(page_title='Chinese lyric workbench', layout='wide')
st.title('Chinese lyric workbench')
if 'project' not in st.session_state:
    st.session_state.project = Project()
elif not isinstance(st.session_state.project, Project):
    # Rebuild retained session data with the current classes after a code reload.
    st.session_state.project = Project.model_validate_json(st.session_state.project.model_dump_json())
if 'workspace' not in st.session_state: st.session_state.workspace = 'All lyrics'
p = st.session_state.project

def replace(project):
    st.session_state.project = project
    st.session_state.revision = st.session_state.get('revision', 0) + 1
    st.session_state.workspace = 'All lyrics'
    st.session_state.last_generation = None
    st.rerun()

with st.sidebar:
    if st.button('Import Macchiato', key='import-macchiato', type='primary'):
        try: replace(import_song())
        except ValueError as exc: st.error(str(exc))
    upload = st.file_uploader('Open project JSON', type=['json'])
    if st.button('Load uploaded JSON') and upload:
        try: replace(Project.model_validate_json(upload.getvalue()))
        except ValueError as exc: st.error(str(exc))
    path = st.text_input('Local project path', 'workbench-projects/song.json')
    if st.button('Reopen local project'):
        try: replace(load(path))
        except (OSError, ValueError) as exc: st.error(str(exc))
    if st.button('Save project'):
        try: save(p, path); st.success('Saved committed edits')
        except (OSError, ValueError) as exc: st.error(str(exc))
    st.download_button('Download project JSON', p.model_dump_json(indent=2), 'song.project.json', 'application/json')

with st.expander('New song from raw lyrics'):
    st.caption('Section labels are stripped; punctuation and newlines split phrases. Repeated phrases share one entry. New timing uses zero placeholders.')
    with st.form('ingest'):
        title = st.text_input('Title')
        artist = st.text_input('Artist')
        raw = st.text_area('Lyrics (add newlines for manual splits)')
        if st.form_submit_button('Create project'): replace(ingest(raw, title, artist))

if p.phrases:
    rev = st.session_state.get('revision', 0)
    with st.expander('Song details and translation notes'):
        with st.form(f'metadata-{rev}'):
            title = st.text_input('Song title', p.metadata['title'])
            artist = st.text_input('Song artist', p.metadata['artist'])
            notes = st.text_area('Translation notes', p.notes)
            if st.form_submit_button('Commit song details'):
                p.metadata.update(title=title, artist=artist); p.notes = notes; st.rerun()
    long = [x.text for x in p.phrases if len(x.text) > 18]
    if long:
        st.warning('Long phrases detected. For raw lyrics, use the suggested midpoint splits below or insert manual newlines before creating the project. Imported keys and timing are preserved.')
        st.code('\n\n'.join(text[:len(text)//2] + '\n' + text[len(text)//2:] for text in long), language=None)
    st.subheader(p.metadata['title'] or 'Untitled song')
    st.caption(f"{p.metadata['artist']} · {len(p.timeline)} lyric lines · {len(p.phrases)} unique phrases")
    mode = st.segmented_control('Workspace', ['All lyrics', 'Review phrase'], key='workspace')
    if mode == 'All lyrics':
        st.caption('The complete song in performance order, including repeated lines. Select a row to edit that phrase. Edits to a repeated phrase apply to every occurrence.')
        by_text = {phrase.text: phrase for phrase in p.phrases}
        lyric_rows = []
        for number, timing in enumerate(p.timeline, 1):
            item = by_text[timing.lyricKey]
            lyric_rows.append({
                'Line': number, 'Chinese': item.text,
                'Pinyin': ' '.join(word.pinyin for word in item.words if word.pinyin),
                'English': item.translation.en, 'Polish': item.translation.pl,
                'Review': 'Reviewed' if all(getattr(item, stage) == 'complete' for stage in ('vocabulary', 'en', 'pl')) else 'Incomplete' if any(getattr(item, stage) == 'pending' for stage in ('vocabulary', 'en', 'pl')) else 'Needs review',
            })
        def open_lyric():
            selected_rows = st.session_state[f'lyrics-{rev}']['selection']['rows']
            if selected_rows:
                selected_text = p.timeline[selected_rows[0]].lyricKey
                st.session_state[f'nav-{rev}'] = by_text[selected_text].id
                st.session_state.workspace = 'Review phrase'
        st.dataframe(lyric_rows, height='content', hide_index=True, key=f'lyrics-{rev}',
                     on_select=open_lyric, selection_mode='single-row',
                     alt='Complete song lyrics with Pinyin, English, Polish and review status',
                     column_config={'Chinese': st.column_config.TextColumn(width='medium'),
                                    'English': st.column_config.TextColumn(width='large'),
                                    'Polish': st.column_config.TextColumn(width='large')})
    else:
        st.subheader('Review a phrase')
        st.caption('Choose a phrase, edit its translations or vocabulary, then commit. Use All lyrics to return to the complete song.')
        selected = st.selectbox('Phrase', [x.id for x in p.phrases], format_func=lambda key: next(x.text for x in p.phrases if x.id == key), key=f'nav-{rev}')
        phrase = next(x for x in p.phrases if x.id == selected)
        st.caption(f'Vocabulary: {phrase.vocabulary} · English: {phrase.en} · Polish: {phrase.pl}. Commit edits before navigating.')
        st.markdown(f'[Wiktionary: {phrase.text}](https://en.wiktionary.org/wiki/{quote(phrase.text)})')
        if phrase.words:
            try: validate_vocabulary(phrase.text, phrase.words)
            except ValueError as exc:
                st.warning(f'Existing vocabulary needs repair: {exc}. Edit the rows below or regenerate vocabulary.')
                if p.metadata.get('artist') == 'Macchiato' and st.button('Restore original Macchiato vocabulary for this phrase', key=f'restore-vocabulary-{rev}-{selected}'):
                    try:
                        original = next((item for item in import_song().phrases if item.text == phrase.text), None)
                        if original is None: raise ValueError('This phrase has no matching vocabulary in the repository song')
                        phrase.words = original.words
                        phrase.vocabulary = 'unverified'
                        phrase.en = phrase.pl = 'needs_review'
                        phrase.provenance.pop('vocabulary', None)
                        st.session_state.revision = rev + 1
                        st.session_state[f'nav-{rev+1}'] = phrase.id
                        st.rerun()
                    except (ValueError, OSError) as error: st.error(str(error))
        with st.form(f'edit-{rev}-{selected}'):
            en = st.text_area('English', phrase.translation.en)
            pl = st.text_area('Polish', phrase.translation.pl)
            st.caption('Edit, add or delete vocabulary and grammar rows. Change Order numbers to reorder on commit. Grammar rows may have empty hanzi and pinyin.')
            rows = st.data_editor([{'order': i+1, 'hanzi': w.hanzi, 'pinyin': w.pinyin, 'gloss': w.translation.en} for i,w in enumerate(phrase.words)] or [{'order': 1, 'hanzi': '', 'pinyin': '', 'gloss': ''}], alt='Editable vocabulary and grammar rows', num_rows='dynamic', key=f'words-{rev}-{selected}', column_config={'order': st.column_config.NumberColumn('Order', required=True, min_value=1), 'gloss': st.column_config.TextColumn('English gloss')})
            reviewed = st.checkbox('Mark all three components reviewed', key=f'review-{rev}-{selected}')
            if st.form_submit_button('Commit phrase edits'):
                try:
                    if any(row.get('order') is None for row in rows): raise ValueError('Every row needs an Order number')
                    new_words = [Word.model_validate({'hanzi': row.get('hanzi') or '', 'pinyin': row.get('pinyin') or '', 'translation': {'en': row.get('gloss') or ''}}) for row in sorted(rows, key=lambda row: row['order']) if any(row.get(key) for key in ('hanzi', 'pinyin', 'gloss'))]
                    if new_words: validate_vocabulary(phrase.text, new_words, require_complete=reviewed)
                    if reviewed and (not new_words or not en.strip() or not pl.strip()):
                        raise ValueError('Review requires vocabulary and both translations')
                    if new_words != phrase.words:
                        phrase.words = new_words; phrase.en = phrase.pl = 'needs_review'; phrase.vocabulary = 'unverified'
                    if en != phrase.translation.en: phrase.translation.en = en; phrase.en = 'unverified'
                    if pl != phrase.translation.pl: phrase.translation.pl = pl; phrase.pl = 'unverified'
                    if reviewed:
                        phrase.vocabulary = phrase.en = phrase.pl = 'complete'
                    st.rerun()
                except (ValueError, TypeError) as exc: st.error(str(exc))
        if st.button('Populate dictionary review reference'):
            try: dictionary(p)
            except OSError as exc: st.error(str(exc))
        with st.expander('Dictionary review reference (not historical generation context)'):
            st.text('\n'.join(phrase.reference) or 'Not populated')
            for word in phrase.words:
                if word.hanzi: st.markdown(f'[{word.hanzi}](https://en.wiktionary.org/wiki/{quote(word.hanzi)})')
        with st.expander('Generation provenance (unknown for imported content)'): st.json(phrase.provenance)
    with st.expander('Translate lyrics', expanded=True):
        scope_options = ['Whole song', 'Current phrase'] if mode == 'Review phrase' else ['Whole song']
        scope = st.radio('Translate', scope_options, index=len(scope_options)-1, horizontal=True, key=f'generation-scope-{rev}-{mode}')
        phrase_ids = {phrase.id} if scope == 'Current phrase' else None
        action = st.radio('What to do', ['Fill missing content', 'Replace selected content'], key='generation-action')
        stages = st.pills('Content to generate', ['vocabulary', 'en', 'pl'],
                          default=['vocabulary', 'en', 'pl'], selection_mode='multi',
                          format_func=lambda stage: LABELS[stage], key='generation-stages')
        jobs, blocked = plan_generation(p, stages, phrase_ids, replace=action == 'Replace selected content')
        total = sum(len(ids) for ids in jobs.values())
        affected = len({key for ids in jobs.values() for key in ids})
        if scope == 'Current phrase': st.write(f'Phrase: {phrase.text}')
        else: st.caption(f'Scope: all {len(p.phrases)} unique phrases. Repeated lyric lines share a translation.')
        if total:
            st.write('Will generate: ' + ' · '.join(f'{LABELS[stage]}: {len(ids)} phrases' for stage, ids in jobs.items() if ids))
            if action == 'Replace selected content':
                st.warning(f'This will replace the selected content for {affected} phrase(s), including imported translations and committed edits. Other content is kept.')
            else:
                st.caption('Existing imported translations and committed edits are kept. Pending work from an interrupted run will resume.')
        elif not stages:
            st.info('Choose at least one type of content to generate.')
        elif not any(blocked.values()):
            st.info('Nothing to generate: this selection already has content. Imported translations still need your review. Choose Replace selected content if you want new translations from the model.')
        if any(blocked.values()):
            st.warning('Some sentences need valid, complete vocabulary first. Generate Vocabulary and Pinyin; if existing rows are invalid, use Replace selected content to repair them.')
        with st.expander('Model settings'):
            model = st.text_input('Model', 'gemma-4-26b-a4b-it', key='generation-model')
            timeout_seconds = st.number_input('Request timeout (seconds)', min_value=15, max_value=300, value=120, step=15, key='generation-timeout', help='Maximum wait per attempt. Large song batches may need longer.')
            schema = st.checkbox('Use structured JSON output', True, key='generation-schema',
                                 help='Disable this if the model reports that JSON schema output is unsupported.')
        st.caption(f'Model: {model}. Results are saved after each completed entry to {path}.')
        label = f"{'Replace' if action == 'Replace selected content' else 'Generate'} content for {affected} phrase(s)"
        if st.button(label if total else 'Nothing to generate', disabled=not total, key='run-generation', type='primary'):
            run_report: GenerationReport = {'model': model, 'scope': scope, 'action': action, 'requested': total,
                      'updated': {stage: [] for stage in jobs}, 'saved': 0,
                      'requests': 0, 'errors': [], 'attempts': [], 'responses': [], 'path': path}
            transport = None
            with st.status('Checking model and credentials…', expanded=True) as status:
                try:
                    def transport_progress(event):
                        if event['kind'] == 'attempt':
                            run_report['requests'] += 1
                            message = f"API attempt {event['attempt']} of {event['maximum']}"
                        else:
                            reason = f"HTTP {event['code']}" if event['code'] is not None else 'network error'
                            message = f"{reason}; retrying in {event['delay']} seconds"
                        run_report['attempts'].append(message)
                        status.update(label=message)
                        st.write(message)
                    transport = GeminiTransport(model, schema, on_event=transport_progress, timeout_seconds=timeout_seconds)
                    if jobs.get('vocabulary') and (ROOT / 'public/cedict_1_0_ts_utf-8_mdbg.txt').is_file():
                        status.update(label='Loading dictionary support for vocabulary…')
                        dictionary(p)
                    for stage, ids in jobs.items():
                        for item in p.phrases:
                            if item.id in ids: setattr(item, stage, 'pending')
                    def progress(event):
                        stage = event['stage']
                        if event['kind'] == 'request':
                            status.update(label=f"Generating {LABELS[stage]} for {event['count']} phrase(s)…")
                            run_report['attempts'].append(f"{'Corrective request' if event['corrective'] else 'Initial request'}: {LABELS[stage]} for {event['count']} phrase(s)")
                            st.write(f"{'Retrying' if event['corrective'] else 'Requesting'} {LABELS[stage]}: {event['count']} phrase(s)")
                        elif event['kind'] == 'response':
                            run_report['responses'].append(event)
                            for phrase_id, reason in event['errors'].items():
                                message = f'{LABELS[stage]} / {phrase_id}: {reason}'
                                run_report['attempts'].append(message)
                                st.write(message)
                        elif event['kind'] == 'updated':
                            run_report['updated'][stage].append(event['id'])
                        elif event['kind'] == 'saved':
                            run_report['saved'] += 1
                            completed = sum(len(ids) for ids in run_report['updated'].values())
                            status.update(label=f'Generated {completed} of {total} entries; saved locally')
                    run_report['errors'] = generate(p, transport, model, checkpoint=lambda: save(p, path),
                                                stages=tuple(jobs), phrase_ids=phrase_ids, on_event=progress)
                except Exception as exc:
                    run_report['errors'].append(str(exc))
                if transport is not None:
                    run_report['requests'] = getattr(transport, 'request_count', run_report['requests'])
                status.update(label='Generation stopped' if run_report['errors'] else 'Generation complete',
                              state='error' if run_report['errors'] else 'complete')
            st.session_state.last_generation = run_report
            st.rerun()
    report = st.session_state.get('last_generation')
    if report:
        updated = sum(len(ids) for ids in report['updated'].values())
        with st.container(border=True):
            st.subheader('Last generation result')
            st.caption(f"{report['scope']} · {report['action']} · {report['model']}")
            summary = f"{updated} of {report['requested']} entries generated · {report['requests']} generation requests"
            if report['errors']:
                st.warning(summary + '. Some work could not be completed.')
                for error in report['errors']: st.error(error)
            elif updated:
                st.success(summary)
            else:
                st.info('No content was generated or changed.')
            st.write(' · '.join(f'{LABELS[stage]}: {len(ids)} updated' for stage, ids in report['updated'].items()))
            if updated:
                if report['saved'] == updated: st.caption(f"Saved to {report['path']}. Review the updated translations above or in All lyrics.")
                else: st.warning('Some changes are only in memory. Use Save project to preserve them.')
            else: st.caption('No translations were saved.')
            if report.get('attempts'):
                with st.expander('Request attempts'):
                    for attempt in report['attempts']: st.text(attempt)
            if report.get('responses'):
                with st.expander('Model responses and validation details'):
                    for index, response in enumerate(report['responses'], 1):
                        st.write(f"Response {index}: {LABELS[response['stage']]}")
                        st.json(response['metadata'])
                        if response['errors']: st.json(response['errors'])
                        st.code(response['text'] or '(empty response)', language='json')
                    st.download_button('Download generation diagnostics', json.dumps(report, ensure_ascii=False, indent=2), 'generation-diagnostics.json', 'application/json')
            if st.button('Dismiss result', key='dismiss-generation-result'):
                st.session_state.last_generation = None
                st.rerun()
    issues = warnings(p)
    if issues: st.warning(f'Draft: {len(issues)} phrases are incomplete or unverified. Draft export is allowed.')
    try: st.download_button('Download TypeScript', export_ts(p), 'song.ts', 'text/plain')
    except ValueError as exc: st.error(f'Export blocked by invalid data: {exc}')
else: st.info('Import Macchiato or create a project from raw lyrics. Import, review, save and export work without API credentials.')
