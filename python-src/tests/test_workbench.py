import json
import subprocess
from pathlib import Path
import pytest
from streamlit.testing.v1 import AppTest
from workbench.models import Project, Word, save, load
from workbench.songs import import_song, ingest, export_ts
from workbench.pinyin import normalize
from workbench.generation import generate
from workbench.transport import ConfigurationError

ROOT = Path(__file__).resolve().parents[2]

@pytest.mark.parametrize('raw,expected', [('ni3 hao3','nǐ hǎo'), ('nu:3','nǚ'), ('lv4','lǜ'), ('ma5 de0','ma de'), ('liu2 gui4','liú guì'), ("piān’ài", "piān'ài"), ('nǐhǎo','nǐhǎo'), ('NI3 HAO3', 'NǏ HǍO'), ('m2', 'ḿ'), ('n1', 'n̄')])
def test_pinyin(raw, expected):
    assert normalize(raw) == expected
    assert normalize(expected) == expected

@pytest.mark.parametrize('raw', ['ni6', '你好', 'ni3!', 'nǐ3', 'abc9'])
def test_bad_pinyin(raw):
    with pytest.raises(ValueError): normalize(raw)

def test_ingest():
    p = ingest('[Chorus]\n愛你，愛你！\n夢想')
    assert [x.text for x in p.phrases] == ['爱你', '梦想']
    assert len(p.timeline) == 3
    assert all(t.startMs == t.endMs == 0 for t in p.timeline)

def test_roundtrip(tmp_path):
    p = import_song()
    assert len(p.timeline) > len(p.phrases)
    assert all(x.en == 'unverified' and not x.provenance for x in p.phrases)
    source = json.loads(subprocess.check_output(['node', str(ROOT / 'scripts/import-song.cjs')]))
    p.phrases[0].translation.pl = 'Zmiana'
    dest = tmp_path / 'project.json'; save(p, dest)
    assert load(dest) == p
    song = tmp_path / 'song.ts'; song.write_text(export_ts(p))
    data = json.loads(subprocess.check_output(['node', str(ROOT / 'scripts/import-song.cjs'), str(song)]))
    assert data['TIMELINE'] == source['TIMELINE']
    assert data['metadata'] == source['metadata']
    source['LYRICS_DICT'][p.phrases[0].text]['translation']['pl'] = 'Zmiana'
    assert data['LYRICS_DICT'] == source['LYRICS_DICT']
    subprocess.run([str(ROOT / 'node_modules/.bin/tsc'), '--noEmit', '--skipLibCheck', '--target', 'ES2018', str(song)], check=True)

def test_unsupported(tmp_path):
    file = tmp_path / 'bad.ts'
    file.write_text('const TIMELINE = makeTimeline(); export default {}; const LYRICS_DICT = {};')
    with pytest.raises(ValueError, match='Unsupported expression'): import_song(file)

def test_invalid_project():
    p = ingest('你')
    data = p.model_dump(); data['timeline'][0]['lyricKey'] = 'missing'
    with pytest.raises(ValueError): Project.model_validate(data)

def test_partial_recovery():
    p = ingest('你\n我')
    calls = []
    def transport(prompt, schema):
        calls.append(prompt)
        if len(calls) == 1:
            return json.dumps({'entries': [{'id': 'p000', 'words': [{'hanzi':'你','pinyin':'ni3','translation':{'en':'you'}}]}, {'id':'p001','words': [{'pinyin':'bad6'}]}]})
        return json.dumps({'entries': [{'id': 'p001', 'words': [{'hanzi':'我','pinyin':'wo3','translation':{'en':'I'}}]}]})
    checkpoints = []
    assert not generate(p, transport, 'mock', lambda: checkpoints.append(1), stages=['vocabulary'])
    assert len(calls) == 2 and len(checkpoints) == 2
    assert '"requested": [{"id": "p001"' in calls[1]
    assert not generate(p, transport, 'mock', stages=['vocabulary'])
    assert len(calls) == 2
    def sentence(prompt, schema):
        return json.dumps({'entries':[{'id':x.id,'text':'sentence'} for x in p.phrases]})
    assert not generate(p, sentence, 'mock', stages=['pl'])
    assert all(x.pl == 'complete' and x.en == 'pending' for x in p.phrases)

def test_split_and_failure():
    p = ingest('你\n我\n他\n她')
    calls = []
    def invalid(prompt, schema): calls.append(prompt); return 'truncated'
    errors = generate(p, invalid, 'mock', stages=['vocabulary'])
    assert len(errors) == 4 and len(calls) == 8

def test_configuration_not_retried():
    p = ingest('你')
    def fail(*args): raise ConfigurationError('bad key')
    with pytest.raises(ConfigurationError): generate(p, fail, 'mock')

def test_app_import_edit_save_reopen(tmp_path, monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    app = AppTest.from_file(ROOT / 'python-src/app.py', default_timeout=45).run()
    def button(label): return next(b for b in app.button if b.label == label)
    button('Import Macchiato').click().run()
    assert not app.exception
    app.segmented_control[0].set_value('Review phrase').run()
    next(x for x in app.text_area if x.label == 'English').set_value('Edited sentence')
    button('Commit phrase edits').click().run()
    next(x for x in app.text_input if x.label == 'Local project path').set_value(str(tmp_path/'review.json'))
    button('Save project').click().run()
    button('Reopen local project').click().run()
    assert not app.exception
    app.segmented_control[0].set_value('Review phrase').run()
    assert next(x for x in app.text_area if x.label == 'English').value == 'Edited sentence'
    assert 'Edited sentence' in export_ts(app.session_state.project)
    app.selectbox[0].select('p001').run()
    app.selectbox[0].select('p000').run()
    assert next(x for x in app.text_area if x.label == 'English').value == 'Edited sentence'

def test_transient_retry_and_credentials(monkeypatch):
    from types import SimpleNamespace
    from workbench.transport import GeminiTransport, ConfigurationError
    from unittest.mock import Mock
    monkeypatch.setattr('workbench.transport.time.sleep', lambda _: None)
    transport = GeminiTransport.__new__(GeminiTransport)
    transport.model = 'mock'; transport.schema = True; transport.usage = []
    transient = RuntimeError('busy'); transient.code = 503
    call = Mock(side_effect=[transient, SimpleNamespace(text='{}', usage_metadata=None)])
    transport.client = SimpleNamespace(models=SimpleNamespace(generate_content=call))
    assert transport('prompt', {}) == '{}'
    assert call.call_count == 2
    denied = RuntimeError('denied'); denied.code = 403
    call.reset_mock(side_effect=True); call.side_effect = denied
    with pytest.raises(ConfigurationError): transport('prompt', {})
    assert call.call_count == 1

def test_resume_from_checkpoint_after_interruption(tmp_path):
    p = ingest('你\n我')
    path = tmp_path / 'recovery.json'
    def transport(prompt, schema):
        return json.dumps({'entries': [{'id':'p000', 'words':[{'hanzi':'你','pinyin':'ni3','translation':{'en':'you'}}]}]})
    errors = generate(p, transport, 'mock', lambda: save(p, path), stages=['vocabulary'])
    assert errors
    recovered = load(path)
    assert recovered.phrases[0].vocabulary == 'complete'
    assert recovered.phrases[1].vocabulary == 'pending'
    calls = []
    def finish(prompt, schema):
        calls.append(prompt)
        return json.dumps({'entries':[{'id':'p001','words':[{'hanzi':'我','pinyin':'wo3','translation':{'en':'I'}}]}]})
    assert not generate(recovered, finish, 'mock', stages=['vocabulary'])
    assert len(calls) == 1
    assert '"requested": [{"id": "p001"' in calls[0]

def test_import_never_implicitly_regenerated():
    p = import_song()
    original = p.model_dump()
    def forbidden(*args): raise AssertionError('Imported data must not be regenerated implicitly')
    assert not generate(p, forbidden, 'mock')
    assert p.model_dump() == original

def test_atomic_save_rejects_invalid_project(tmp_path):
    p = ingest('你')
    path = tmp_path / 'song.json'
    save(p, path)
    original = path.read_bytes()
    p.timeline[0].__dict__['startMs'] = -1
    with pytest.raises(ValueError): save(p, path)
    assert path.read_bytes() == original

def test_numbered_committed_rows():
    word = Word(hanzi='女', pinyin='nu:3', translation={'en':'woman'})
    assert word.pinyin == 'nǚ'
    with pytest.raises(ValueError): word.pinyin = 'nu7'

def test_import_shows_complete_song_and_updates_repetitions(monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    app = AppTest.from_file(ROOT / 'python-src/app.py', default_timeout=45).run()
    app.button(key='import-macchiato').click().run()
    assert not app.exception
    project = app.session_state.project
    assert app.segmented_control(key='workspace').value == 'All lyrics'
    table = app.dataframe[0].value
    assert len(table) == len(project.timeline)
    assert table['Chinese'].tolist() == [line.lyricKey for line in project.timeline]
    assert table['English'].tolist() == [next(p.translation.en for p in project.phrases if p.text == line.lyricKey) for line in project.timeline]
    assert table['Polish'].tolist() == [next(p.translation.pl for p in project.phrases if p.text == line.lyricKey) for line in project.timeline]
    repeated = next(p for p in project.phrases if sum(t.lyricKey == p.text for t in project.timeline) > 1)
    app.segmented_control(key='workspace').set_value('Review phrase').run()
    app.selectbox[0].select(repeated.id).run()
    next(x for x in app.text_area if x.label == 'English').set_value('Updated repeated phrase')
    next(b for b in app.button if b.label == 'Commit phrase edits').click().run()
    app.segmented_control(key='workspace').set_value('All lyrics').run()
    assert not app.exception
    table = app.dataframe[0].value
    assert set(table.loc[table['Chinese'] == repeated.text, 'English']) == {'Updated repeated phrase'}

def test_current_google_sdk_configuration(monkeypatch, tmp_path):
    from unittest.mock import Mock
    from types import SimpleNamespace
    from google import genai
    from google.genai import types
    from httpx2 import ReadTimeout
    from workbench.transport import GeminiTransport
    from workbench import config as local_config
    env_file = tmp_path / '.env'
    env_file.write_text('GEMINI_API_KEY=offline-test-key\n')
    monkeypatch.setattr(local_config, 'ENV_PATHS', (env_file,))
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    monkeypatch.setattr('workbench.transport.time.sleep', lambda _: None)
    client = Mock()
    client.models.get.return_value = SimpleNamespace(supported_actions=['generateContent'])
    client.models.generate_content.side_effect = [ReadTimeout('temporary timeout'), SimpleNamespace(text='{"entries":[]}', usage_metadata=None)]
    constructor = Mock(return_value=client)
    monkeypatch.setattr(genai, 'Client', constructor)
    transport = GeminiTransport('mock-model')
    assert constructor.call_args.kwargs['api_key'] == 'offline-test-key'
    assert constructor.call_args.kwargs['http_options'].timeout == 120000
    assert constructor.call_args.kwargs['http_options'].retry_options.attempts == 1
    assert transport('prompt', {'type':'object'}) == '{"entries":[]}'
    assert client.models.generate_content.call_count == 2
    config = client.models.generate_content.call_args.kwargs['config']
    assert isinstance(config, types.GenerateContentConfig)
    assert config.response_mime_type == 'application/json'
    assert config.response_json_schema == {'type':'object'}

@pytest.mark.parametrize('exported', [False, True])
def test_dotenv_loading_and_precedence(tmp_path, monkeypatch, exported):
    from workbench import config
    import os
    python_env = tmp_path / 'python-src' / '.env'
    python_env.parent.mkdir()
    root_env = tmp_path / '.env'
    python_env.write_text('GEMINI_API_KEY=python-test-value\nWORKBENCH_CONFIG_TEST=python\n')
    root_env.write_text('GEMINI_API_KEY=root-test-value\nWORKBENCH_CONFIG_TEST=root\nWORKBENCH_FALLBACK_TEST=fallback\n')
    monkeypatch.setattr(config, 'ENV_PATHS', (python_env, root_env))
    for key in ('GEMINI_API_KEY', 'WORKBENCH_CONFIG_TEST', 'WORKBENCH_FALLBACK_TEST'):
        monkeypatch.delenv(key, raising=False)
    if exported: monkeypatch.setenv('GEMINI_API_KEY', 'process-test-value')
    other_directory = tmp_path / 'elsewhere'
    other_directory.mkdir()
    monkeypatch.chdir(other_directory)
    config.load_environment()
    assert os.environ['GEMINI_API_KEY'] == ('process-test-value' if exported else 'python-test-value')
    assert os.environ['WORKBENCH_CONFIG_TEST'] == 'python'
    assert os.environ['WORKBENCH_FALLBACK_TEST'] == 'fallback'

def test_generation_preview_and_blocked_sentences():
    from workbench.generation_plan import plan_generation
    p = import_song()
    before = p.model_dump()
    jobs, blocked = plan_generation(p, ['vocabulary', 'en', 'pl'])
    assert not any(jobs.values()) and not any(blocked.values())
    jobs, _ = plan_generation(p, ['en'], {p.phrases[1].id}, replace=True)
    assert jobs == {'en': [p.phrases[1].id]}
    assert p.model_dump() == before
    raw = ingest('你')
    jobs, blocked = plan_generation(raw, ['en'])
    assert jobs == {'en': []} and blocked == {'en': ['p000']}
    jobs, blocked = plan_generation(raw, ['en', 'vocabulary'])
    assert jobs == {'vocabulary': ['p000'], 'en': ['p000']} and not any(blocked.values())

def test_generation_scope_and_progress():
    p = ingest('你\n我')
    events = []
    def transport(prompt, schema):
        return json.dumps({'entries': [{'id':'p001', 'words':[{'hanzi':'我','pinyin':'wo3','translation':{'en':'I'}}]}]})
    assert not generate(p, transport, 'mock', stages=['vocabulary'], phrase_ids={'p001'}, on_event=events.append)
    assert p.phrases[0].vocabulary == 'pending'
    assert p.phrases[1].vocabulary == 'complete'
    assert [e['kind'] for e in events] == ['request', 'response', 'updated', 'saved']

def test_app_no_work_explains_without_contacting_model(monkeypatch):
    from unittest.mock import Mock
    constructor = Mock(side_effect=AssertionError('No model call expected'))
    monkeypatch.setattr('workbench.transport.GeminiTransport', constructor)
    app = AppTest.from_file(ROOT / 'python-src/app.py', default_timeout=45).run()
    app.button(key='import-macchiato').click().run()
    assert not app.exception
    assert app.button(key='run-generation').disabled
    assert any('Nothing to generate: this selection already has content' in x.value for x in app.info)
    assert not app.success
    assert not constructor.called

def test_app_generation_reports_counts_and_refreshes_editor(tmp_path, monkeypatch):
    class FakeTransport:
        def __init__(self, *args, **kwargs): self.request_count = 0
        def __call__(self, prompt, schema):
            self.request_count += 1
            data = json.loads(prompt.splitlines()[-1])
            return json.dumps({'entries':[{'id': item['id'], 'text': 'New test translation'} for item in data['requested']]})
    monkeypatch.setattr('workbench.transport.GeminiTransport', FakeTransport)
    app = AppTest.from_file(ROOT / 'python-src/app.py', default_timeout=45).run()
    app.button(key='import-macchiato').click().run()
    app.segmented_control(key='workspace').set_value('Review phrase').run()
    app.selectbox[0].select('p001').run()
    original = app.session_state.project.phrases[0].translation.en
    app.radio(key='generation-action').set_value('Replace selected content').run()
    app.pills(key='generation-stages').set_value(['en']).run()
    next(x for x in app.text_input if x.label == 'Local project path').set_value(str(tmp_path/'generated.json')).run()
    assert not app.button(key='run-generation').disabled
    app.button(key='run-generation').click().run()
    assert not app.exception
    assert any('1 of 1 entries generated' in x.value and '1 generation requests' in x.value for x in app.success)
    assert next(x for x in app.text_area if x.label == 'English').value == 'New test translation'
    assert app.session_state.project.phrases[0].translation.en == original
    assert load(tmp_path/'generated.json').phrases[1].translation.en == 'New test translation'
    app.segmented_control(key='workspace').set_value('All lyrics').run()
    assert any('1 of 1 entries generated' in x.value for x in app.success)

def test_app_configuration_failure_does_not_claim_generation(monkeypatch):
    from unittest.mock import Mock
    monkeypatch.setattr('workbench.transport.GeminiTransport', Mock(side_effect=ConfigurationError('Test credential failure')))
    app = AppTest.from_file(ROOT / 'python-src/app.py', default_timeout=45).run()
    app.button(key='import-macchiato').click().run()
    before = app.session_state.project.model_dump()
    app.radio(key='generation-action').set_value('Replace selected content').run()
    app.button(key='run-generation').click().run()
    assert not app.exception and not app.success
    assert any('Test credential failure' in x.value for x in app.error)
    assert app.session_state.last_generation['requests'] == 0
    assert app.session_state.last_generation['saved'] == 0
    assert app.session_state.project.model_dump() == before

def test_backend_reload_preserves_project_and_replaces_stale_modules(tmp_path):
    import importlib
    import inspect
    import sys
    from types import ModuleType
    app = AppTest.from_file(ROOT / 'python-src/app.py', default_timeout=45).run()
    app.button(key='import-macchiato').click().run()
    app.session_state.project.phrases[0].translation.en = 'Keep this committed edit'
    before = app.session_state.project.model_dump()
    old_project_class = type(app.session_state.project)
    package = sys.modules['workbench']
    package.__dict__['__workbench_revision__'] = 'old backend revision'
    legacy = ModuleType('workbench.runtime')
    sys.modules['workbench.runtime'] = legacy  # Deliberately lacks get_transport_class.
    old_generation = sys.modules['workbench.generation']
    old_generation.generate = lambda project, transport, model: []
    app.run()
    assert not app.exception
    assert app.session_state.project.model_dump() == before
    assert type(app.session_state.project) is not old_project_class
    current = importlib.import_module('workbench.generation')
    assert current is not old_generation
    assert 'phrase_ids' in inspect.signature(current.generate).parameters
    assert 'workbench.runtime' not in sys.modules
    next(x for x in app.text_input if x.label == 'Local project path').set_value(str(tmp_path/'preserved.json')).run()
    next(b for b in app.button if b.label == 'Save project').click().run()
    assert not app.exception
    assert json.loads((tmp_path/'preserved.json').read_text())['phrases'][0]['translation']['en'] == 'Keep this committed edit'

@pytest.mark.parametrize('code', [500, '500'])
def test_real_sdk_500_retries_are_counted_and_reported(monkeypatch, code):
    from google.genai import errors
    from workbench.transport import GeminiTransport, GenerationServiceError
    from unittest.mock import Mock
    from types import SimpleNamespace
    monkeypatch.setattr('workbench.transport.time.sleep', lambda _: None)
    error = errors.ServerError(500, {'error': {'code':500, 'message':'Internal error encountered.', 'status':'INTERNAL'}})
    error.code = code
    transport = GeminiTransport.__new__(GeminiTransport)
    transport.model = 'mock'; transport.schema = True; transport.usage = []; transport.request_count = 0
    events = []; transport.on_event = events.append
    call = Mock(side_effect=error)
    transport.client = SimpleNamespace(models=SimpleNamespace(generate_content=call))
    with pytest.raises(GenerationServiceError, match='HTTP 500 after 3 attempts'):
        transport('prompt', {'type':'object'})
    assert call.call_count == transport.request_count == 3
    assert [e['kind'] for e in events] == ['attempt', 'retry', 'attempt', 'retry', 'attempt']
    assert [e['delay'] for e in events if e['kind']=='retry'] == [1, 2]

def test_normal_reruns_keep_backend_classes():
    app = AppTest.from_file(ROOT / 'python-src/app.py', default_timeout=45).run()
    project_class = type(app.session_state.project)
    app.run()
    assert not app.exception
    assert type(app.session_state.project) is project_class

@pytest.mark.parametrize('wrapper', ['{}', '```json\n{}\n```', '```\n{}\n```'])
def test_model_json_fences_are_accepted(wrapper):
    from workbench.responses import decode_entries
    payload = json.dumps({'entries':[{'id':'p000','text':'A sentence'}]})
    assert decode_entries(wrapper.replace('{}', payload)) == [{'id':'p000','text':'A sentence'}]

def test_validation_failure_retains_output_and_corrects_exact_error():
    from workbench.generation import generate
    p = ingest('你')
    events, prompts = [], []
    malformed = json.dumps({'entries':[{'id':'p000','words':[{'hanzi':'你','pinyin':'ni6','translation':{'en':'you'}}]}]})
    def transport(prompt, schema):
        prompts.append(prompt)
        return malformed
    errors = generate(p, transport, 'mock', stages=['vocabulary'], on_event=events.append)
    assert len(prompts) == 2
    assert 'words.0.pinyin' in errors[0] and 'Invalid Pinyin' in errors[0]
    assert 'words.0.pinyin' in prompts[1] and 'Invalid Pinyin' in prompts[1]
    responses = [event for event in events if event['kind']=='response']
    assert len(responses) == 2 and all(response['text']==malformed for response in responses)
    assert p.phrases[0].vocabulary == 'pending'

@pytest.mark.parametrize('raw,reason', [('', 'no answer text'), ('{"entries":', 'Invalid JSON'), ('{"words":[]}', 'missing the entries'), ('{"entries":[{"id":"wrong","words":[]}]}', 'returned IDs: wrong')])
def test_response_failure_explains_actual_reason(raw, reason):
    from workbench.generation import generate
    p = ingest('你')
    errors = generate(p, lambda *args: raw, 'mock', stages=['vocabulary'])
    assert reason in errors[0]

def test_app_exposes_failed_response_diagnostics(monkeypatch):
    class InvalidTransport:
        def __init__(self, *args, **kwargs):
            self.request_count = 0
            self.last_response = {'finish_reasons':['MAX_TOKENS']}
        def __call__(self, *args):
            self.request_count += 1
            return '{"entries":'
    monkeypatch.setattr('workbench.transport.GeminiTransport', InvalidTransport)
    app = AppTest.from_file(ROOT / 'python-src/app.py', default_timeout=45).run()
    app.button(key='import-macchiato').click().run()
    app.segmented_control(key='workspace').set_value('Review phrase').run()
    app.radio(key='generation-action').set_value('Replace selected content').run()
    app.pills(key='generation-stages').set_value(['vocabulary']).run()
    app.button(key='run-generation').click().run()
    assert not app.exception and not app.success
    assert any('Invalid JSON' in error.value for error in app.error)
    assert app.session_state.last_generation['requests'] == 2
    assert len(app.session_state.last_generation['responses']) == 2
    assert app.session_state.last_generation['responses'][0]['metadata']['finish_reasons'] == ['MAX_TOKENS']
    assert any(code.value == '{"entries":' for code in app.code)

@pytest.mark.parametrize('hanzi,pinyin', [('你','pinyin'), ('属','pinyin'), ('你','hello'), ('你','nǐhǎo'), ('专属','zhuān')])
def test_generated_vocabulary_rejects_bogus_pronunciation(hanzi, pinyin):
    from workbench.vocabulary import validate_vocabulary
    word = Word(hanzi=hanzi, pinyin=pinyin, translation={'en':'test'})
    with pytest.raises(ValueError): validate_vocabulary(hanzi, [word])

@pytest.mark.parametrize('hanzi,pinyin', [('你','nǐ'), ('专属','zhuānshǔ'), ('偏爱',"piān'ài"), ('心照不宣','xīnzhàobùxuān'), ('的','de'), ('嗯','n̄')])
def test_vocabulary_accepts_compounds_and_neutral_tones(hanzi, pinyin):
    from workbench.vocabulary import validate_vocabulary
    validate_vocabulary(hanzi, [Word(hanzi=hanzi, pinyin=pinyin, translation={'en':'gloss'})])

def test_vocabulary_requires_complete_lyric_in_order():
    from workbench.vocabulary import validate_vocabulary
    words = [Word(hanzi='对', pinyin='duì', translation={'en':'toward'}), Word(hanzi='你', pinyin='nǐ', translation={'en':'you'})]
    with pytest.raises(ValueError, match='complete Chinese lyric'): validate_vocabulary('对你的偏爱', words)
    with pytest.raises(ValueError, match='order'): validate_vocabulary('你对', words)
    with pytest.raises(ValueError, match='only Chinese characters'):
        validate_vocabulary('你', [Word(hanzi='phrase-level', translation={'en':'a sentence'})])

def test_screenshot_vocabulary_never_replaces_existing_words():
    from workbench.generation import generate
    p = import_song()
    original = p.phrases[0].words.copy()
    p.phrases[0].vocabulary = 'pending'
    bad = [{'hanzi':'对','pinyin':'duì','translation':{'en':'to; verse; towards'}},
           {'hanzi':'你','pinyin':'pinyin','translation':{'en':'you'}},
           {'hanzi':'专','pinyin':'zhuān','translation':{'en':'exclusive; special'}},
           {'hanzi':'属','pinyin':'pinyin','translation':{'en':'belonging to'}},
           {'hanzi':'的','pinyin':'de','translation':{'en':'possessive particle'}},
           {'hanzi':'phrase-level','pinyin':'','translation':{'en':'Exclusive preference for you'}}]
    errors = generate(p, lambda *args: json.dumps({'entries':[{'id':'p000','words':bad}]}), 'mock', stages=['vocabulary'], phrase_ids={'p000'})
    assert errors and 'placeholder' in errors[0]
    assert [w.model_dump() for w in p.phrases[0].words] == [w.model_dump() for w in original]
    assert p.phrases[0].vocabulary == 'pending'

def test_bad_saved_vocabulary_can_be_opened_but_not_exported(tmp_path):
    from workbench.models import Word, save, load
    from workbench.songs import ingest, export_ts
    p = ingest('你')
    p.phrases[0].words = [Word(hanzi='你', pinyin='pinyin', translation={'en':'you'})]
    save(p, tmp_path/'bad.json')
    reopened = load(tmp_path/'bad.json')
    assert reopened.phrases[0].words[0].pinyin == 'pinyin'
    with pytest.raises(ValueError, match='placeholder'): export_ts(reopened)

def test_sentence_generation_refuses_invalid_vocabulary():
    from workbench.generation import generate
    p = ingest('你')
    p.phrases[0].words = [Word(hanzi='你', pinyin='pinyin', translation={'en':'you'})]
    p.phrases[0].vocabulary = 'complete'
    from workbench.generation_plan import plan_generation
    jobs, blocked = plan_generation(p, ['en'])
    assert jobs['en'] == [] and blocked['en'] == ['p000']
    calls = []
    generate(p, lambda *args: calls.append(args), 'mock', stages=['en'])
    assert not calls

def test_invalid_vocabulary_is_corrected_before_committing():
    from workbench.generation import generate
    from workbench.songs import import_song
    p = import_song()
    good = {'id':p.phrases[0].id,'words':[w.model_dump() for w in p.phrases[0].words]}
    bad = json.loads(json.dumps(good))
    bad['words'][1]['pinyin'] = 'pinyin'
    responses = iter([bad, good])
    prompts = []
    def transport(prompt, schema):
        prompts.append(prompt)
        return json.dumps({'entries':[next(responses)]})
    p.phrases[0].vocabulary = 'pending'
    assert not generate(p, transport, 'mock', stages=['vocabulary'], phrase_ids={p.phrases[0].id})
    assert len(prompts) == 2 and 'placeholder' in prompts[1]
    assert p.phrases[0].vocabulary == 'complete'
    assert [w.model_dump() for w in p.phrases[0].words] == good['words']
    context = p.phrases[0].provenance['vocabulary']['injected_context']
    assert context['segmentation_hint'] == ('对','你','专属','的','偏爱')

@pytest.mark.parametrize('text,pinyin', [('花儿','huār'), ('一点儿','yìdiǎnr')])
def test_vocabulary_allows_erhua(text,pinyin):
    from workbench.vocabulary import validate_vocabulary
    validate_vocabulary(text, [Word(hanzi=text,pinyin=pinyin,translation={'en':'test'})])

def test_app_restores_only_broken_macchiato_vocabulary():
    app = AppTest.from_file(ROOT / 'python-src/app.py', default_timeout=45).run()
    app.button(key='import-macchiato').click().run()
    app.session_state.project.phrases[0].words[1].pinyin = 'pinyin'
    app.session_state.project.phrases[0].translation.en = 'Keep my sentence edit'
    app.segmented_control(key='workspace').set_value('Review phrase').run()
    assert not app.exception
    assert any('placeholder' in w.value for w in app.warning)
    next(b for b in app.button if b.label == 'Restore original Macchiato vocabulary for this phrase').click().run()
    assert not app.exception
    phrase = app.session_state.project.phrases[0]
    assert phrase.words[1].pinyin == 'nǐ'
    assert phrase.translation.en == 'Keep my sentence edit'
    assert phrase.vocabulary == 'unverified'
    assert phrase.en == 'needs_review'
