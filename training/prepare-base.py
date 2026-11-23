import pathlib,json,hashlib,shutil
from huggingface_hub import hf_hub_download
root=pathlib.Path(__file__).resolve().parent;m=json.loads((root/'base-source.json').read_text());out=root/'cache/qwen-base';out.mkdir(parents=True,exist_ok=True);records=[]
for f in m['files']:
    if f['path']=='.gitattributes':continue
    target=out/f['path']
    if not target.exists() and shutil.disk_usage(out).free<f['size']+350_000_000:raise RuntimeError('Insufficient disk reserve')
    p=pathlib.Path(hf_hub_download(m['repo'],f['path'],revision=m['revision'],local_dir=out));digest=hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
    if f['lfs']:assert digest==f['lfs']['sha256']
    records.append({'path':f['path'],'sha256':digest,'bytes':p.stat().st_size});print(f['path'],digest,flush=True)
(root/'BASE-MANIFEST.json').write_text(json.dumps({'repo':m['repo'],'revision':m['revision'],'files':records},indent=2)+'\n')
