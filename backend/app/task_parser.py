
import re
from datetime import date, timedelta


def parse_task(transcript: str) -> dict:
    text = " ".join((transcript or "").strip().split())
    lower = text.lower()

    # Priority
    priority = "Medium"

    if any(w in lower for w in [
        "urgent", "high priority", "higher priority",
        "high-priority", "higher-priority",
        "important", "very important", "zaroori",
        "जरूरी", "ज़रूरी", "ज्यादा जरूरी",
        "ਜਰੂਰੀ", "ਜ਼ਰੂਰੀ", "ਜ਼ਿਆਦਾ ਜ਼ਰੂਰੀ"
    ]):
        priority = "High"

    elif any(w in lower for w in [
        "low priority", "low-priority", "not urgent",
        "कम priority", "कम जरूरी", "ਘੱਟ ਜ਼ਰੂਰੀ"
    ]):
        priority = "Low"

    # Category
    category = "General"
    category_words = {
        "Study": [
            "assignment", "exam", "study", "homework",
            "class", "college", "dbms", "python",
            "पढ़", "ਪੜ੍ਹ"
        ],
        "Work": ["meeting", "office", "work", "client", "project"],
        "Health": [
            "doctor", "medicine", "workout", "exercise",
            "health", "appointment"
        ],
        "Finance": ["bill", "payment", "bank", "budget", "fee", "fees"],
        "Personal": [
            "buy", "shopping", "family", "birthday",
            "call mom", "personal"
        ],
    }

    for label, words in category_words.items():
        if any(word in lower for word in words):
            category = label
            break

    # Date
    task_date = None
    today = date.today()

    if re.search(r"\btomorrow\b|\bkal\b|कल|ਕੱਲ੍ਹ", lower):
        task_date = (today + timedelta(days=1)).isoformat()
    elif re.search(r"\btoday\b|आज|ਅੱਜ", lower):
        task_date = today.isoformat()

    # Time
    task_time = None
    match = re.search(
        r"\b(?:at|by|around)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b",
        lower
    )

    if not match:
        match = re.search(
            r"\b(\d{1,2}):(\d{2})\s*(am|pm)?\b",
            lower
        )

    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or "0")
        meridiem = match.group(3)

        if meridiem == "pm" and hour < 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0

        if 0 <= hour <= 23 and 0 <= minute <= 59:
            task_time = f"{hour:02d}:{minute:02d}"

    # Clean the title
    title = text

    patterns = [
        r"\b(?:tomorrow|today|kal)\b.*$",
        r"\b(?:at|by|around)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$",
        r"\b(?:high|higher|medium|low)\s+priority\b",
        r"\b(?:urgent|important|very important)\b",
        r"कल.*$", r"आज.*$", r"ਕੱਲ੍ਹ.*$", r"ਅੱਜ.*$",
    ]

    for pattern in patterns:
        title = re.sub(pattern, "", title, flags=re.IGNORECASE).strip(" ,.-")

    title = re.sub(
        r"^(please\s+)?(remind me to|remind me|add a task to|"
        r"add task|create a task to|create task|i need to|"
        r"मुझे|मुझे करना है|ਮੈਨੂੰ)\s*",
        "",
        title,
        flags=re.IGNORECASE
    )

    title = title.strip(" ,.-") or text[:180] or "New task"

    return {
        "title": title[:180],
        "date": task_date,
        "time": task_time,
        "priority": priority,
        "category": category,
        "transcript": text,
    }