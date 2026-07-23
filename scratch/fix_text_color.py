import os
import re

files = [
    r"src/app/request/RequestWizard.tsx",
    r"src/app/host/dashboard/page.tsx",
    r"src/app/admin/dashboard/page.tsx",
    r"src/app/admin/fiveday/page.tsx",
    r"src/app/admin/scan/page.tsx",
    r"src/app/admin/smtp/page.tsx",
    r"src/app/admin/webcam/page.tsx",
    r"src/app/components/CheckInForm.tsx",
    r"src/app/lookup/page.tsx"
]

def fix_file(file_path):
    abs_path = os.path.join(r"e:\visit", file_path)
    if not os.path.exists(abs_path):
        return

    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace bg-white ... text-white inside inputs/selects/textareas to text-slate-800
    # Match className="..." strings containing bg-white and text-white
    def replacer(match):
        class_str = match.group(0)
        # Only replace text-white if it contains bg-white or bg-[#F8F9FA] or similar light bg
        if "bg-white" in class_str or "bg-[#F8F9FA]" in class_str or "bg-slate-50" in class_str:
            # Avoid replacing text-white if there is bg-[#0F4C81] or text-white is used for a button or badge
            if not ("bg-[#0F4C81]" in class_str or "bg-indigo-600" in class_str or "bg-emerald-600" in class_str or "bg-rose-600" in class_str or "bg-red-600" in class_str or "bg-teal-600" in class_str or "bg-indigo-500" in class_str or "bg-emerald-500" in class_str):
                class_str = class_str.replace("text-white", "text-slate-800")
        return class_str

    content = re.sub(r'className="[^"]+"', replacer, content)
    content = re.sub(r"className=\{`[^`]+`\}", replacer, content)

    # Specific cleanups for headers in dashboard page
    content = content.replace("text-3xl font-extrabold text-white", "text-3xl font-extrabold text-slate-900")
    content = content.replace("text-2xl font-bold text-white", "text-2xl font-bold text-slate-900")
    content = content.replace("text-xl font-bold text-white", "text-xl font-bold text-slate-900")
    content = content.replace("text-lg font-bold text-white", "text-lg font-bold text-slate-900")
    content = content.replace("text-md font-bold text-white", "text-md font-bold text-slate-900")
    content = content.replace("font-bold text-white", "font-bold text-slate-900")
    content = content.replace("text-white tracking-tight", "text-slate-900 tracking-tight")
    content = content.replace("text-white font-mono", "text-slate-800 font-mono")
    content = content.replace("text-white font-sans", "text-slate-900 font-sans")
    content = content.replace("text-white flex flex-col font-sans", "text-slate-900 flex flex-col font-sans")
    content = content.replace("text-white flex items-center justify-center", "text-slate-900 flex items-center justify-center")
    content = content.replace("tracking-tight text-white", "tracking-tight text-slate-900")
    content = content.replace("text-sm font-semibold text-white", "text-sm font-semibold text-slate-800")

    # In webcam page
    content = content.replace("bg-white text-white flex flex-col font-sans", "bg-[#F8F9FA] text-slate-900 flex flex-col font-sans")
    content = content.replace("bg-white flex items-center justify-center text-white font-sans text-sm", "bg-white flex items-center justify-center text-slate-700 font-sans text-sm")

    # In host page
    content = content.replace("bg-white text-white flex flex-col font-sans", "bg-[#F8F9FA] text-slate-900 flex flex-col font-sans")
    content = content.replace("bg-white flex items-center justify-center text-white font-sans text-sm", "bg-white flex items-center justify-center text-slate-700 font-sans text-sm")

    # Fix placeholder text color to be light grey
    content = content.replace("placeholder-slate-700", "placeholder-slate-400")
    content = content.replace("placeholder-slate-600", "placeholder-slate-400")

    # Accordions
    content = content.replace("text-emerald-400 font-bold", "text-emerald-600 font-bold")
    content = content.replace("text-red-400 font-bold", "text-red-600 font-bold")
    content = content.replace("text-red-500 font-bold", "text-red-600 font-bold")

    with open(abs_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Fixed text color in: {file_path}")

for f in files:
    fix_file(f)
