"""Restore unchanged audit archives from lossless GitHub text transport."""
import argparse,base64,hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');args=p.parse_args()
manifest=json.loads((ROOT/'experiments/next-audit/payloads/MANIFEST.json').read_text())
for row in manifest['artifacts']:
    target=ROOT/row['path'];payload=ROOT/row['payload']
    if not target.resolve().is_relative_to(ROOT/'experiments/next-audit') or target.suffix!='.gz':raise ValueError('Unexpected artifact path')
    data=base64.b64decode(payload.read_text().strip(),validate=True)
    assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256']
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==row['gitBlobSha']
    if target.exists():
        if target.read_bytes()!=data:raise ValueError('Refusing to overwrite different artifact: '+row['path'])
    elif not args.check:
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    print(('Verified ' if args.check else 'Restored/verified ')+row['path'])
