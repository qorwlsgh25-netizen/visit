import os

def standardize_request_wizard():
    path = r"e:\visit\src\app\request\RequestWizard.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace labels block text-[11px] -> block text-xs
    content = content.replace("block text-[11px] font-semibold text-slate-600 mb-1.5", "block text-xs font-semibold text-slate-600 mb-2")
    
    # Replace inputs pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs
    content = content.replace("pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800", "pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800")
    
    # Replace inputs w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs
    content = content.replace("w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800", "w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800")
    
    # Replace icon span absolute left-3 top-2.5
    content = content.replace("absolute left-3 top-2.5 text-[#0F4C81] text-xs", "absolute left-3 top-1/2 -translate-y-1/2 text-[#0F4C81] text-xs")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Standardized RequestWizard.tsx labels and inputs")

standardize_request_wizard()
