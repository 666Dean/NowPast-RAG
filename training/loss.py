"""Supervise exactly target token indices [assistant_offset, length)."""
import mlx.core as mx
import mlx.nn as nn
def masked_loss(model,batch,lengths):
    inputs=batch[:,:-1];targets=batch[:,1:];logits=model(inputs)
    target_indices=mx.arange(1,targets.shape[1]+1)
    mask=(target_indices>=lengths[:,0:1]) & (target_indices<lengths[:,1:])
    count=mask.sum();loss=(nn.losses.cross_entropy(logits,targets)*mask).astype(mx.float32).sum()/count
    return loss,count
