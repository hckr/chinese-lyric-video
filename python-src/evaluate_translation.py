"""Opt-in, paid live evaluation. Run from repository root; never run by pytest."""
import argparse
import json
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from workbench.models import save
from workbench.songs import ingest, dictionary
from workbench.transport import GeminiTransport
from workbench.generation import generate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('lyrics', type=Path)
    parser.add_argument('--model', default='gemma-4-26b-a4b-it')
    parser.add_argument('--small-batch', type=int, default=4)
    parser.add_argument('--output', type=Path, default=Path('workbench-projects/evaluation'))
    parser.add_argument('--no-schema', action='store_true')
    parser.add_argument('--live', action='store_true', help='Required acknowledgement: sends paid API requests')
    args = parser.parse_args()
    if not args.live: parser.error('--live is required to send requests')
    if args.small_batch < 1: parser.error('--small-batch must be positive')
    report = {}
    for name, size in [('whole-song', None), ('small-batches', args.small_batch)]:
        project = ingest(args.lyrics.read_text(encoding='utf8'))
        dictionary(project)
        transport = GeminiTransport(args.model, not args.no_schema)
        start = time.monotonic()
        path = args.output / (name + '.json')
        errors = generate(project, transport, args.model, lambda: save(project, path), batch_size=size)
        save(project, path)
        report[name] = {'seconds': time.monotonic()-start, 'requests': len(transport.usage), 'usage': transport.usage, 'errors': errors}
    report['human_review'] = {key: 'Compare both projects; record score 1–5 and concrete phrase examples' for key in ['meaning', 'literal_glosses', 'dictionary_pronunciation', 'contextual_gender', 'natural_English', 'natural_Polish']}
    (args.output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf8')

if __name__ == '__main__': main()
