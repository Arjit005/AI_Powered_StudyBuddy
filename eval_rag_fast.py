import time
from backend.embedding_service import EmbeddingService
from backend.rag_service import RAGService

def cos_sim(v1, v2):
    return sum(a * b for a, b in zip(v1, v2))

corpus = {
    "doc_1": "Mitochondria are double-membrane-bound organelles found in most eukaryotic organisms that generate most of the chemical energy needed to power biochemical reactions.",
    "doc_2": "Adenosine triphosphate (ATP) serves as the primary energetic currency of cells, produced through cellular respiration and oxidative phosphorylation.",
    "doc_3": "Photosynthesis allows green plants and certain organisms to convert light energy into chemical energy stored in glucose molecules.",
    "doc_4": "Cellular mitosis is the process of nuclear division by which a replicated genome is segregated into two identical sets of chromosomes.",
    "doc_5": "The central bank raised benchmark interest rates to combat persistent post-pandemic inflation and stabilize domestic currency values."
}

queries = [
    {
        "q": "What organelle produces cellular energy?",
        "relevant": ["doc_1", "doc_2"],
    },
    {
        "q": "How do cells make ATP?",
        "relevant": ["doc_2", "doc_1"],
    },
    {
        "q": "How do plants convert sunlight into sugars?",
        "relevant": ["doc_3"],
    },
    {
        "q": "What mechanism handles chromosome segregation during cell division?",
        "relevant": ["doc_4"],
    }
]

print("--- Step 1: Hash embeddings ---")
doc_embs_hash = {k: RAGService._compute_semantic_embedding(v, dim=1536) for k, v in corpus.items()}
hash_ranks = []
for q_item in queries:
    q_emb = RAGService._compute_semantic_embedding(q_item["q"], dim=1536)
    scores = [(k, cos_sim(q_emb, doc_embs_hash[k])) for k in corpus]
    scores.sort(key=lambda x: x[1], reverse=True)
    rank = next(i + 1 for i, (did, _) in enumerate(scores) if did in q_item["relevant"])
    hash_ranks.append(rank)
    print(f"Hash Q: '{q_item['q']}' -> Relevant rank: {rank}")

mrr_hash = sum(1.0 / r for r in hash_ranks) / len(hash_ranks)
print(f"Hash Baseline MRR: {mrr_hash:.3f}")

print("\n--- Step 2: Batch Neural embeddings for corpus ---")
c_keys = list(corpus.keys())
c_texts = [corpus[k] for k in c_keys]
t0 = time.time()
batch_res = EmbeddingService.embed_batch(c_texts)
doc_embs_neural = {k: vec for k, vec in zip(c_keys, batch_res)}
print(f"Batch embedded 5 docs in {(time.time()-t0):.2f}s")

print("\n--- Step 3: Batch Neural embeddings for queries ---")
q_texts = [item["q"] for item in queries]
t1 = time.time()
q_batch_res = EmbeddingService.embed_batch(q_texts)
q_embs_neural = {item["q"]: vec for item, vec in zip(queries, q_batch_res)}
print(f"Batch embedded 4 queries in {(time.time()-t1):.2f}s")

neural_ranks = []
for q_item in queries:
    q_emb = q_embs_neural[q_item["q"]]
    scores = [(k, cos_sim(q_emb, doc_embs_neural[k])) for k in corpus]
    scores.sort(key=lambda x: x[1], reverse=True)
    rank = next(i + 1 for i, (did, _) in enumerate(scores) if did in q_item["relevant"])
    neural_ranks.append(rank)
    print(f"Neural Q: '{q_item['q']}' -> Relevant rank: {rank}, Scores: {[(k, round(s, 3)) for k, s in scores[:3]]}")

mrr_neural = sum(1.0 / r for r in neural_ranks) / len(neural_ranks)
print(f"\nNeural MRR: {mrr_neural:.3f}")
print(f"Evaluation complete! MRR improvement: {mrr_hash:.3f} -> {mrr_neural:.3f}")
