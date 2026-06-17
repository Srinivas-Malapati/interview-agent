"""Curated seed questions per role × focus area.

These aren't asked verbatim — the LLM uses them as STYLE references for the
kind of question that should be asked next. That keeps the AI grounded in
real interview themes without becoming canned.

Sources: Glassdoor, Levels.fyi, Blind, real interview reports from FAANG +
high-growth startups (Stripe, OpenAI, Anthropic, Notion, Linear, Figma).
"""
import random
from typing import List

BANK = {
    # ════════════════════════════════════════════════
    # SOFTWARE ENGINEER
    # ════════════════════════════════════════════════
    ("Software Engineer", "System Design"): [
        "Design a URL shortener that handles 100M new URLs/day. Walk me through capacity, the data model, and how you'd avoid hot keys.",
        "How would you design a distributed rate limiter? Cover the algorithm, where state lives, and what happens during a partition.",
        "Design an idempotency layer for a payments API. What identifier do you key on, where does it live, and how long do you retain it?",
        "Design a feature flag service called from a hot path. Latency budget is 5ms p99 — how do you hit it?",
        "Walk me through designing Twitter's home timeline. Fan-out on write vs read — when do you choose which?",
        "Design a real-time chat system that supports 1M concurrent users. Focus on the message delivery guarantees.",
        "How would you build a video upload + transcoding pipeline that handles 10K uploads/hour?",
        "Design a job scheduler like cron, but distributed and reliable across 1000+ nodes.",
        "Build the data layer for Uber's surge pricing — sub-second updates over a geo-indexed dataset.",
        "Design Slack's message search across 10B messages. Cover indexing strategy and query latency.",
    ],
    ("Software Engineer", "Algorithms"): [
        "Given a stream of numbers, return the running median efficiently. Walk me through your approach and the complexity.",
        "How would you detect a near-duplicate document at scale (100B docs)? Discuss the hashing scheme.",
        "Explain how a consistent hash ring works and when you'd choose it over modulo sharding.",
        "You have a 10TB log file and 2GB of RAM. Find the top 100 most frequent strings.",
        "Implement a thread-safe LRU cache. What invariants matter and what locks do you take?",
        "Given a graph of N nodes, find all strongly connected components. Walk me through Tarjan's vs Kosaraju's.",
        "Design an algorithm to merge K sorted streams of data. Memory and time complexity?",
    ],
    ("Software Engineer", "Behavioral"): [
        "Tell me about a project that didn't go as planned. What changed, and what would you do differently?",
        "Describe a technical disagreement with a more senior engineer. How did you handle it?",
        "Walk me through the most complex bug you've ever debugged — what made it hard, how did you find it?",
        "Tell me about a time you had to push back on a product manager's request. How did it land?",
        "Describe a time you shipped something that broke in production. What was your role in the response?",
        "Tell me about a project where you had to learn an unfamiliar codebase fast. How did you approach it?",
        "Walk me through a time you mentored another engineer. What worked, what didn't?",
        "Describe a feature you advocated for that didn't get built. How did you handle it?",
    ],
    ("Software Engineer", "Culture"): [
        "What does 'good code review' look like to you?",
        "How do you decide when to push back on a deadline?",
        "What's your approach when joining a new codebase with no documentation?",
        "How do you balance shipping fast with engineering quality?",
        "Describe a team culture you've thrived in. What made it work?",
    ],

    # ════════════════════════════════════════════════
    # AI / ML ENGINEER (NEW)
    # ════════════════════════════════════════════════
    ("AI Engineer", "System Design"): [
        "Design a RAG pipeline for a 10M-document corpus that needs sub-2-second p95 retrieval latency. What's your chunking strategy?",
        "Build an LLM evaluation framework for a customer-facing chatbot. How do you catch regressions before they hit prod?",
        "Design a real-time content moderation system using LLMs that handles 10K msg/sec. Cost and latency constraints?",
        "Walk me through designing an agent that books flights — handles ambiguity, asks clarifying questions, and never hallucinates a flight that doesn't exist.",
        "Design a multi-tenant LLM serving layer where some customers pay for GPT-4 and some for cheaper models. How do you route?",
        "How would you build a vector search system on Postgres without specialized DB? Trade-offs vs Pinecone/Weaviate?",
        "Design a fine-tuning pipeline that turns user feedback into a better model every week. Data flywheel architecture?",
    ],
    ("AI Engineer", "Behavioral"): [
        "Tell me about a model you shipped to production. What was the metric you moved and by how much?",
        "Walk me through an LLM project where the first prototype was bad. How did you iterate?",
        "Describe a time you had to debug a hallucination issue. What was the root cause?",
        "Tell me about how you decided between fine-tuning vs prompt engineering for a specific use case.",
        "Walk me through a project where you balanced LLM quality, latency, and cost. What was the trade-off?",
        "Describe a time you pushed back on shipping an AI feature because it wasn't safe enough yet. What happened?",
    ],
    ("AI Engineer", "Algorithms"): [
        "Explain how attention works at a layer-of-detail you'd use to debug an actual production bug.",
        "Walk me through the math of LoRA fine-tuning and why it works.",
        "How would you build a semantic search system that ranks results combining keyword + vector + freshness signals?",
        "Explain why temperature 0 isn't actually deterministic across runs and what you'd do about it.",
        "How does speculative decoding work? When does it actually help in production?",
    ],

    # ════════════════════════════════════════════════
    # DATA SCIENTIST
    # ════════════════════════════════════════════════
    ("Data Scientist", "System Design"): [
        "Design a feature store for an ML training and serving pipeline. Cover training/serving skew.",
        "How would you build an experimentation platform that supports A/B tests at 1M events/sec?",
        "Design a recommendation system for a content platform. Cold-start, exploration vs exploitation, and feedback loops.",
        "Walk me through building a real-time anomaly detection system for payment fraud.",
        "Design a churn prediction pipeline that updates daily. Cover labeling, feature engineering, and model retraining cadence.",
    ],
    ("Data Scientist", "Behavioral"): [
        "Tell me about a model you shipped to production. What was the metric you moved and by how much?",
        "Describe a time your analysis contradicted what a stakeholder wanted to hear.",
        "Walk me through a time you had to push back on a business request because the data didn't support it.",
        "Tell me about a project where data quality was the real problem, not the model.",
        "Describe a time you ran an A/B test that showed no effect. How did you communicate it?",
    ],
    ("Data Scientist", "Algorithms"): [
        "When would you choose a tree-based model over a neural network? Walk me through the trade-offs.",
        "Explain how XGBoost actually works at a level deep enough to debug it.",
        "How do you handle severely imbalanced classes? Walk through 3 approaches and when each is right.",
        "Walk me through how you'd build a causal inference framework for a feature rollout.",
    ],

    # ════════════════════════════════════════════════
    # PRODUCT MANAGER
    # ════════════════════════════════════════════════
    ("Product Manager", "Product Sense"): [
        "How would you measure success for a new 'Saved Searches' feature on a job board?",
        "Pick a product you use daily. What's one thing you'd change and why? Estimate the impact.",
        "How would you prioritize between a $1M revenue feature and a churn-reducing one with unclear lift?",
        "Stripe wants to enter the consumer payments market. Walk me through the product strategy.",
        "How would you decide whether to build, buy, or partner for a new AI feature?",
        "Design the next-generation onboarding flow for Notion. What's the activation metric?",
        "What's a metric companies overweight that doesn't actually predict long-term success? Why?",
        "How would you turn around a feature with low adoption 3 months after launch?",
    ],
    ("Product Manager", "Behavioral"): [
        "Tell me about a feature you killed. Why, and what did you learn?",
        "Walk me through how you'd onboard to a new team in your first 30 days.",
        "Describe a time you disagreed with engineering on technical scope. How did it resolve?",
        "Tell me about a time you shipped something that didn't work. What did you do next?",
        "Walk me through a product decision you made with incomplete data. How did you decide?",
        "Describe a time you had to manage a stakeholder who outranked you. What worked?",
    ],
    ("Product Manager", "System Design"): [
        "Walk me through the technical decisions you'd make for a real-time collaboration product (e.g. Figma).",
        "How would you decide whether to build features as microservices vs a monolith from a PM lens?",
        "Talk me through how you'd think about API rate limiting from a product perspective.",
    ],

    # ════════════════════════════════════════════════
    # PRODUCT DESIGNER
    # ════════════════════════════════════════════════
    ("Product Designer", "Product Sense"): [
        "Walk me through a recent design where you had to choose between consistency and clarity.",
        "How do you decide when a flow needs progressive disclosure versus all-on-one-screen?",
        "Show me a design you'd reject in a review. Why?",
        "How would you redesign Gmail's search to be more discoverable?",
        "Walk through your process for designing an onboarding flow for a complex B2B product.",
    ],
    ("Product Designer", "Behavioral"): [
        "Tell me about a design that got pushed back by engineering. How did you respond?",
        "Walk me through a time you had to ship a design you weren't happy with. Why, and what happened?",
        "Describe how you handle design feedback from non-designers.",
        "Tell me about a research insight that completely changed a product direction.",
    ],
}

FALLBACK = [
    "Walk me through a recent project you led. Goal, your role, and the impact in metrics.",
    "Tell me about a time you made a hard trade-off. What did you give up and why?",
    "Describe a system you designed end-to-end — the architecture choices and why.",
    "Walk me through the most technically challenging thing you've shipped in the last year.",
    "Tell me about a project that taught you something you didn't expect.",
]


def pick_seeds(role: str, seniority: str, focus_list: list, k: int = 3) -> List[str]:
    """Return k seed questions matching the role and any of the focus areas.
    Senior+ gets the harder System Design / Algorithms set; junior leans Behavioral.
    """
    role = role or "Software Engineer"
    foci = focus_list or ["Behavioral"]

    if seniority and seniority.lower() in ("junior", "intern"):
        foci = list(set(foci + ["Behavioral"]))

    # AI Engineer is a role we now have native support for — normalize aliases
    role_norm = role
    if any(k in role.lower() for k in ("ai engineer", "ml engineer", "machine learning")):
        role_norm = "AI Engineer"

    pool = []
    for f in foci:
        pool.extend(BANK.get((role_norm, f), []))
    if not pool:
        for (r, _), qs in BANK.items():
            if r == role_norm:
                pool.extend(qs)
    if not pool:
        pool = FALLBACK[:]

    random.shuffle(pool)
    return pool[: max(1, k)]
