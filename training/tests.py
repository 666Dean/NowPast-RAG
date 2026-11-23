import unittest
from data import world,sample,validate,TASKS,CONFIG
class EventTests(unittest.TestCase):
    def test_future_assignment_is_not_yet_effective(self):
        found=0
        for i in range(1000):
            w=world('train',i,CONFIG['seed'])
            if w['scene']=='future' and w['identity']['lessonDate'] is None:
                found+=1
                for j,t in enumerate(TASKS[i%4]):validate(sample(w,t,j))
                for a in w['qa']['answers'].values():
                    for c in a['citations']:
                        d=next(d for d in w['docs'] if d['id']==c['id']);self.assertLessEqual(d['effective'],w['asOf'])
        self.assertGreater(found,0)
    def test_exact_loss_mask_excludes_all_padding_and_includes_eos(self):
        import mlx.core as mx
        from loss import masked_loss
        class Model:
            def __call__(self,x):return mx.zeros((x.shape[0],x.shape[1],32))
        # row1 target indices 3,4; row2 index2 only. No pad at length index.
        batch=mx.array([[1,2,3,4,5,0,0],[1,2,6,0,0,0,0]])
        loss,count=masked_loss(Model(),batch,mx.array([[3,5],[2,3]]));self.assertEqual(int(count),3);self.assertAlmostEqual(float(loss),float(mx.log(mx.array(32.))),places=5)
    def test_all_scenes_and_tasks_pass_source_checks(self):
        for i in range(300):
            for split in ['train','valid','test']:
                w=world(split,i,CONFIG['seed'])
                for j,t in enumerate(TASKS[i%4]):validate(sample(w,t,j))
if __name__=='__main__':unittest.main()
