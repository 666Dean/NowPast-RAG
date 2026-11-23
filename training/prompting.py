import json
def decoder_schema(schema):
    # Large finite bounds expand nested regex state machines. Relax ONLY the
    # decoder upper bound; the original schema remains authoritative in JS.
    if isinstance(schema,list):return [decoder_schema(x) for x in schema]
    if not isinstance(schema,dict):return schema
    return {k:decoder_schema(v) for k,v in schema.items() if not (k in ['maxItems','maxLength'] and isinstance(v,int) and v>8)}
def prepare_messages(tokenizer,system,model_input,schema):
    # Schema constrains logits outside the language prompt. Repeating its large
    # nested branches here invites schema copying and shifts the SFT task format.
    messages=[{'role':'system','content':system+'\n只返回JSON，不复述输出结构。'},
      {'role':'user','content':json.dumps(model_input,ensure_ascii=False,separators=(',',':'))}]
    rendered=tokenizer.apply_chat_template(messages,tokenize=False,add_generation_prompt=True)
    return messages,rendered
