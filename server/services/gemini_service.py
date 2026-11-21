import os
import json

GOOGLE_AI_API_KEY = os.environ.get("GOOGLE_AI_API_KEY")

_model = None


def _get_model():
    # the SDK takes about 350 ms to import and only uploads use it
    global _model
    if _model is None and GOOGLE_AI_API_KEY:
        import google.generativeai as genai

        genai.configure(api_key=GOOGLE_AI_API_KEY)
        _model = genai.GenerativeModel("gemini-3-flash-preview")
    return _model


def analyze_image(image_bytes: bytes) -> dict:
    model = _get_model()
    if not model:
        return {"description": None, "tags": []}

    prompt = """Analyze this photo and return a JSON object with:
1. "description": A concise 1-2 sentence description of the photo suitable for a blog post or alt text. Be specific about what you see.
2. "tags": An array of 5-10 relevant tags/keywords for this photo (lowercase, single words or short phrases).

Return ONLY valid JSON, no markdown or extra text."""

    response = model.generate_content([
        prompt,
        {"mime_type": "image/jpeg", "data": image_bytes},
    ])

    try:
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(text)
        return {
            "description": result.get("description", ""),
            "tags": result.get("tags", []),
        }
    except (json.JSONDecodeError, IndexError):
        return {"description": response.text.strip()[:500], "tags": []}
