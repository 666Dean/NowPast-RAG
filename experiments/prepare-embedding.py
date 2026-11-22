"""Download a pinned ONNX semantic embedding model; never use a moving revision."""
import hashlib, json, pathlib
from huggingface_hub import hf_hub_download
root=pathlib.Path(__file__).resolve().parent
config=json.loads((root/'config.json').read_text());repo=config['embedding'];revision=config['embeddingRevision']
files=[]
for name in ['tokenizer.json','config.json','onnx/model_quantized.onnx']:
    path=pathlib.Path(hf_hub_download(repo,name,revision=revision,local_dir=root/'cache/bge'))
    files.append({'path':name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
manifest={'repo':repo,'revision':revision,'pooling':'CLS','normalize':'L2','similarity':'dot product','files':files}
(root/'cache/embedding-model.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps(manifest,indent=2))
