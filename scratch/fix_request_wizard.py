import re
import os

def fix_request_wizard():
    file_path = r"e:\visit\src\app\request\RequestWizard.tsx"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Step indicators text
    content = content.replace('step >= item.num ? "text-white" : "text-[#0F4C81]"', 'step >= item.num ? "text-[#0F4C81] font-bold" : "text-slate-400"')

    # Accordion Headers: font-semibold text-white
    content = content.replace("font-semibold text-white", "font-semibold text-slate-800")
    
    # Text headers: font-bold text-white
    content = content.replace("font-bold text-white", "font-bold text-slate-900")
    content = content.replace("font-extrabold text-white", "font-extrabold text-slate-900")
    
    # Inputs: text-white
    content = re.sub(r'(rounded-xl text-sm )text-white\b', r'\1text-slate-800', content)
    content = re.sub(r'(rounded-xl text-xs )text-white\b', r'\1text-slate-800', content)
    content = re.sub(r'text-white( focus:outline-none)', r'text-slate-800\1', content)
    content = content.replace("option key={`start-${time}`} value={time} className=\"bg-white text-white\"", "option key={`start-${time}`} value={time} className=\"bg-white text-slate-800\"")
    content = content.replace("option key={`end-${time}`} value={time} className=\"bg-white text-white\"", "option key={`end-${time}`} value={time} className=\"bg-white text-slate-800\"")

    # Labels and selections: text-white font-medium
    content = content.replace("text-white font-medium ml-1", "text-slate-700 font-medium ml-1")
    content = content.replace("text-sm font-semibold text-white", "text-sm font-semibold text-slate-800")
    
    # Created data summary labels
    content = content.replace("text-white font-medium", "text-slate-800 font-medium")
    content = content.replace("code className=\"text-xs text-white", "code className=\"text-xs text-slate-800")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed RequestWizard.tsx")

fix_request_wizard()
