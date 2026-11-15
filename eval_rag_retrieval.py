import time
from dotenv import load_dotenv

load_dotenv("backend/.env")
load_dotenv(".env")

from backend.embedding_service import EmbeddingService
from backend.rag_service import RAGService


def cos_sim(v1, v2):
    return sum(a * b for a, b in zip(v1, v2))


# Evaluation Corpus (5 passages covering cell biology, plant biology, genetics, and macroeconomics)
corpus = {
    "doc_1": "Mitochondria are double-membrane-bound organelles found in most eukaryotic organisms that generate most of the chemical energy needed to power biochemical reactions.",
    "doc_2": "Adenosine triphosphate (ATP) serves as the primary energetic currency of cells, produced through cellular respiration and oxidative phosphorylation.",
    "doc_3": "Photosynthesis allows green plants and certain organisms to convert light energy into chemical energy stored in glucose molecules.",
    "doc_4": "Cellular mitosis is the process of nuclear division by which a replicated genome is segregated into two identical sets of chromosomes.",
    "doc_5": "The central bank raised benchmark interest rates to combat persistent post-pandemic inflation and stabilize domestic currency values."
}

# Queries designed specifically to test semantic understanding vs lexical matching
queries = [
    {
        "q": "What organelle produces cellular energy?",
        "relevant": ["doc_1", "doc_2"],
        "description": "Semantic synonym query (no direct word overlap with organelle)"
    },
    {
        "q": "How do cells make ATP?",
        "relevant": ["doc_2", "doc_1"],
        "description": "Paraphrased bioenergetics query"
    },
    {
        "q": "How do plants convert sunlight into sugars?",
        "relevant": ["doc_3"],
        "description": "Lexical-semantic transfer (sunlight vs light energy, sugars vs glucose)"
    },
    {
        "q": "What mechanism handles chromosome segregation during cell division?",
        "relevant": ["doc_4"],
        "description": "Conceptual genetics query"
    }
]


def run_evaluation():
    print("================================================================")
    print("      REPRODUCIBLE SEMANTIC RETRIEVAL BENCHMARK EVALUATION       ")
    print("================================================================\n")

    # 1. Old Deterministic SHA-256 Hash Projection Baseline
    print("--- 1. Evaluating Hash-Projection Baseline (Commit 7b14b78) ---")
    t0 = time.time()
    doc_embs_hash = {k: RAGService._compute_semantic_embedding(v, dim=1536) for k, v in corpus.items()}
    hash_ranks = []
    for q_item in queries:
        q_emb = RAGService._compute_semantic_embedding(q_item["q"], dim=1536)
        scores = [(k, cos_sim(q_emb, doc_embs_hash[k])) for k in corpus]
        scores.sort(key=lambda x: x[1], reverse=True)
        rank = next(i + 1 for i, (did, _) in enumerate(scores) if did in q_item["relevant"])
        hash_ranks.append(rank)
        print(f"Query: \"{q_item['q']}\"")
        print(f"  Top rank of relevant doc: {rank} (Scores: {[(k, round(s, 3)) for k, s in scores[:3]]})")
    hash_duration = (time.time() - t0) * 1000

    mrr_hash = sum(1.0 / r for r in hash_ranks) / len(hash_ranks)
    recall1_hash = sum(1 for r in hash_ranks if r == 1) / len(hash_ranks)
    recall5_hash = sum(1 for r in hash_ranks if r <= 5) / len(hash_ranks)

    print(f"\nHash-Projection Baseline Metrics:")
    print(f"  MRR (Mean Reciprocal Rank): {mrr_hash:.3f}")
    print(f"  Recall@1: {recall1_hash:.3f}")
    print(f"  Recall@5: {recall5_hash:.3f}")
    print(f"  Total Duration: {hash_duration:.1f} ms\n")

    # 2. New Neural Embedding Architecture (Gemini-Embedding-001, 1536 dim)
    print("--- 2. Evaluating Neural Embedding Architecture (Batch 2) ---")
    t1 = time.time()
    doc_embs_neural = {k: EmbeddingService.embed_text(v, task_type="retrieval_document") for k, v in corpus.items()}
    neural_ranks = []
    neural_precisions = []

    for q_item in queries:
        q_emb = EmbeddingService.embed_text(q_item["q"], task_type="retrieval_query")
        scores = [(k, cos_sim(q_emb, doc_embs_neural[k])) for k in corpus]
        scores.sort(key=lambda x: x[1], reverse=True)
        rank = next(i + 1 for i, (did, _) in enumerate(scores) if did in q_item["relevant"])
        neural_ranks.append(rank)

        # Precision@1 (Is top-1 hit relevant?)
        p1 = 1.0 if scores[0][0] in q_item["relevant"] else 0.0
        neural_precisions.append(p1)

        print(f"Query: \"{q_item['q']}\"")
        print(f"  Top rank of relevant doc: {rank} (Scores: {[(k, round(s, 3)) for k, s in scores[:3]]})")
    neural_duration = (time.time() - t1) * 1000

    mrr_neural = sum(1.0 / r for r in neural_ranks) / len(neural_ranks)
    recall1_neural = sum(1 for r in neural_ranks if r == 1) / len(neural_ranks)
    recall5_neural = sum(1 for r in neural_ranks if r <= 5) / len(neural_ranks)
    p1_neural = sum(neural_precisions) / len(neural_precisions)

    print(f"\nNeural Architecture Metrics:")
    print(f"  MRR (Mean Reciprocal Rank): {mrr_neural:.3f}")
    print(f"  Recall@1: {recall1_neural:.3f}")
    print(f"  Recall@5: {recall5_neural:.3f}")
    print(f"  Precision@1: {p1_neural:.3f}")
    print(f"  Total Duration: {neural_duration:.1f} ms\n")

    print("================================================================")
    print(f"Improvement in MRR: {mrr_hash:.3f} -> {mrr_neural:.3f} (+{((mrr_neural - mrr_hash)/max(mrr_hash, 0.001))*100:.1f}%)")
    print(f"Improvement in Recall@1: {recall1_hash:.3f} -> {recall1_neural:.3f} (+{((recall1_neural - recall1_hash)/max(recall1_hash, 0.001))*100:.1f}%)")
    print("================================================================")


if __name__ == "__main__":
    run_evaluation()
