import unittest,pathlib,json,re
from outlines_core.json_schema import build_regex_from_schema
from transformers import AutoTokenizer
from outlines.inputs import Chat
from outlines.models.mlxlm import MLXLMTypeAdapter
from prompting import prepare_messages,decoder_schema
class PromptTests(unittest.TestCase):
    def test_real_decoder_enforces_complete_or_pending_union(self):
        def branch(minimum,maximum,pending):
            return {'type':'object','properties':{'clauses':{'type':'array','minItems':minimum,'maxItems':maximum,'items':{'type':'string'}},'pending':{'type':'boolean','enum':[pending]}},'required':['clauses','pending'],'additionalProperties':False}
        schema={'oneOf':[branch(1,80,False),branch(0,0,True)]}
        pattern=build_regex_from_schema(json.dumps(decoder_schema(schema)))
        for clauses,pending,accepted in [([],False,False),([],True,True),(['x'],False,True),(['x'],True,False)]:
            self.assertEqual(bool(re.fullmatch(pattern,json.dumps({'clauses':clauses,'pending':pending}))),accepted)
    def test_exactly_one_chat_template(self):
        tok=AutoTokenizer.from_pretrained(pathlib.Path(__file__).resolve().parent/'cache/qwen-base',local_files_only=True)
        messages,rendered=prepare_messages(tok,'校务助理',{'task':'extract','text':'虚构安排'},{'type':'object'})
        adapter=MLXLMTypeAdapter(tok,has_chat_template=True)
        self.assertEqual(adapter.format_input(Chat(messages)),rendered)
        self.assertNotEqual(adapter.format_input(rendered),rendered)
        self.assertEqual(rendered.count('<|im_start|>system'),1)
    def test_large_decoder_bounds_are_relaxed_without_mutating_validation_schema(self):
        schema={'type':'array','maxItems':80,'items':{'type':'string','minLength':1,'maxLength':240}}
        lowered=decoder_schema(schema)
        self.assertNotIn('maxItems',lowered);self.assertNotIn('maxLength',lowered['items']);self.assertEqual(lowered['items']['minLength'],1)
        self.assertEqual(schema['maxItems'],80);self.assertEqual(schema['items']['maxLength'],240)
if __name__=='__main__':unittest.main()
