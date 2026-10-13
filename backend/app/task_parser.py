
import re
from datetime import date, timedelta


# Convert a voice transcript into structured task details.
def parse_task(transcript: str) -> dict:

    # Clean extra spaces from the transcript.
    text = " ".join((transcript or "").strip().split())
    lower = text.lower()

    today = date.today()

    # -----------------------------------------------
    # 1. Detect task priority
    # -----------------------------------------------
    priority = "Medium"

    high_priority_words = [
        "urgent",
        "high priority",
        "important",
        "zaroori",
        "जरूरी",
        "ज़रूरी",
        "ਜਰੂਰੀ",
        "ਜ਼ਰੂਰੀ",
    ]

    low_priority_words = [
        "low priority",
        "not urgent",
        "कम जरूरी",
        "ਘੱਟ ਜ਼ਰੂਰੀ",
    ]

    if any(word in lower for word in high_priority_words):
        priority = "High"

    elif any(word in lower for word in low_priority_words):
        priority = "Low"

    # -----------------------------------------------
    # 2. Detect task category
    # -----------------------------------------------
    category = "General"

    category_words = {
        "Study": [
            "assignment",
            "exam",
            "study",
            "homework",
            "class",
            "college",
            "dbms",
            "python",
            "पढ़",
            "ਪੜ੍ਹ",
            "असाइनमेंट",
            "ਇਮਤਿਹਾਨ",
        ],
        "Work": [
            "meeting",
            "office",
            "work",
            "client",
            "project",
        ],
        "Health": [
            "doctor",
            "medicine",
            "workout",
            "exercise",
        ],
        "Finance": [
            "bill",
            "payment",
            "bank",
            "budget",
            "fee",
        ],
        "Personal": [
            "shopping",
            "family",
            "birthday",
            "personal",
        ],
    }

    for label, words in category_words.items():
        if any(word in lower for word in words):
            category = label
            break

    # -----------------------------------------------
    # 3. Detect task type
    # -----------------------------------------------
    task_type = "Task"

    assignment_words = [
        "assignment",
        "homework",
        "असाइनमेंट",
        "ਹੋਮਵਰਕ",
    ]

    exam_words = [
        "exam",
        "test",
        "इम्तिहान",
        "परीक्षा",
        "ਇਮਤਿਹਾਨ",
    ]

    if any(word in lower for word in assignment_words):
        task_type = "Assignment"

    elif any(word in lower for word in exam_words):
        task_type = "Exam"

    elif "meeting" in lower:
        task_type = "Meeting"

    elif "reminder" in lower or "remind me" in lower:
        task_type = "Reminder"

    elif any(word in lower for word in ["personal", "shopping"]):
        task_type = "Personal"

    # -----------------------------------------------
    # 4. Detect the task date
    # -----------------------------------------------
    task_date = None

    tomorrow_pattern = r"\btomorrow\b|\bkal\b|कल|ਕੱਲ੍ਹ"
    today_pattern = r"\btoday\b|आज|ਅੱਜ"

    if re.search(tomorrow_pattern, lower):
        task_date = (
            today + timedelta(days=1)
        ).isoformat()

    elif re.search(today_pattern, lower):
        task_date = today.isoformat()

    # -----------------------------------------------
    # 5. Detect the task time
    # -----------------------------------------------
    task_time = None

    # Match expressions such as:
    # "at 6 pm", "by 6:30 pm", or "around 10".
    match = re.search(
        r"\b(?:at|by|around)\s*"
        r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b",
        lower,
    )

    # If necessary, try a time written as "18:00".
    if not match:
        match = re.search(
            r"\b(\d{1,2}):(\d{2})\s*(am|pm)?\b",
            lower,
        )

    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or "0")
        meridiem = match.group(3)

        # Convert 12-hour time into 24-hour time.
        if meridiem == "pm" and hour < 12:
            hour += 12

        elif meridiem == "am" and hour == 12:
            hour = 0

        # Accept only valid hours and minutes.
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            task_time = f"{hour:02d}:{minute:02d}"

    # -----------------------------------------------
    # 6. Clean the task title
    # -----------------------------------------------
    title = text

    title_patterns = [
        r"\b(?:tomorrow|today|kal)\b.*$",
        r"\b(?:at|by|around)\s+"
        r"\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$",
        r"\b(?:high|higher|medium|low)\s+priority\b",
        r"\b(?:urgent|important|very important)\b",
        r"कल.*$",
        r"आज.*$",
        r"ਕੱਲ੍ਹ.*$",
        r"ਅੱਜ.*$",
    ]

    for pattern in title_patterns:
        title = re.sub(
            pattern,
            "",
            title,
            flags=re.IGNORECASE,
        ).strip(" ,.-")

    # Remove common task-creation phrases.
    title = re.sub(
        r"^(please\s+)?"
        r"(remind me to|remind me|add a task to|"
        r"add task|create a task to|create task|"
        r"i need to|मुझे|मੈਨੂੰ)\s*",
        "",
        title,
        flags=re.IGNORECASE,
    )

    title = title.strip(" ,.-")

    if not title:
        title = text[:180] or "New task"

    # -----------------------------------------------
    # 7. Return all extracted task details
    # -----------------------------------------------
    return {
        "title": title[:180],
        "date": task_date,
        "time": task_time,
        "priority": priority,
        "category": category,
        "type": task_type,
        "transcript": text,
    }