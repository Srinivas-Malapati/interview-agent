def parse_jd(text: str):
    role = "Software Engineer"
    t = text.lower()
    if "designer" in t:
        role = "Product Designer"
    elif "manager" in t:
        role = "Project/Product Manager"
    return {"role": role, "description": text}
