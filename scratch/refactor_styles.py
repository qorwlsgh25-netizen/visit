import re
import os

files_to_refactor = [
    r"src/app/request/RequestWizard.tsx",
    r"src/app/host/dashboard/page.tsx",
    r"src/app/admin/dashboard/page.tsx",
    r"src/app/admin/fiveday/page.tsx",
    r"src/app/admin/scan/page.tsx",
    r"src/app/admin/smtp/page.tsx",
    r"src/app/admin/webcam/page.tsx",
    r"src/app/components/CheckInForm.tsx"
]

def refactor_file(file_path):
    abs_path = os.path.join(r"e:\visit", file_path)
    if not os.path.exists(abs_path):
        print(f"File not found: {abs_path}")
        return

    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Backgrounds
    content = content.replace("bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950", "bg-[#F8F9FA]")
    content = content.replace("bg-gradient-to-tr from-slate-950 via-indigo-950 to-slate-950", "bg-[#F8F9FA]")
    content = content.replace("bg-slate-950/40", "bg-white")
    content = content.replace("bg-slate-950/30", "bg-[#F8F9FA]")
    content = content.replace("bg-slate-950/20", "bg-[#F8F9FA]")
    content = re.sub(r'bg-slate-950\b(?!\/)(?!.*option)', 'bg-white', content) # bg-slate-950 (but keep for option/dark stuff if needed, wait, inputs should be bg-white)
    content = content.replace("bg-slate-950", "bg-white")
    
    content = content.replace("bg-indigo-950/10", "bg-white")
    content = content.replace("bg-indigo-950/20", "bg-white")
    content = content.replace("bg-indigo-950/30", "bg-slate-50")
    content = content.replace("bg-indigo-950/40", "bg-white")
    content = content.replace("bg-indigo-950/5", "bg-slate-50")
    content = content.replace("bg-indigo-950/60", "bg-slate-50")
    content = content.replace("bg-slate-900/40", "bg-white")
    content = content.replace("bg-slate-900/90", "bg-white")
    content = content.replace("bg-slate-900", "bg-white")
    
    # Modal bg overlay
    content = content.replace("bg-slate-950/80", "bg-slate-900/40")

    # 2. Borders
    content = content.replace("border-indigo-900/40", "border-slate-200")
    content = content.replace("border-indigo-900/30", "border-slate-200")
    content = content.replace("border-indigo-900/60", "border-slate-200")
    content = content.replace("border-indigo-900/20", "border-slate-100")
    content = content.replace("border-indigo-900", "border-slate-200")
    content = content.replace("border-indigo-950/40", "border-slate-200")
    content = content.replace("border-indigo-950/30", "border-slate-200")
    content = content.replace("border-indigo-950/50", "border-slate-200")
    content = content.replace("border-indigo-950/55", "border-slate-200")
    content = content.replace("border-indigo-950/40", "border-slate-200")
    content = content.replace("border-indigo-950", "border-slate-200")
    content = content.replace("border-indigo-800", "border-slate-300")
    content = content.replace("border-indigo-500/30", "border-[#0F4C81]/30")
    content = content.replace("border-indigo-500/20", "border-[#0F4C81]/20")
    content = content.replace("border-indigo-500", "border-[#0F4C81]")
    content = content.replace("border-indigo-600", "border-[#0F4C81]")

    # 3. Text Colors (exclude buttons and badges with specific classes if possible)
    # Convert common text colors
    content = content.replace("text-indigo-400", "text-[#0F4C81]")
    content = content.replace("text-indigo-300", "text-slate-600")
    content = content.replace("text-indigo-200", "text-slate-500")
    content = content.replace("text-indigo-100", "text-slate-800")
    content = content.replace("text-slate-200", "text-slate-800")
    content = content.replace("text-slate-300", "text-slate-700")
    content = content.replace("text-slate-400", "text-slate-600")
    
    # 4. Buttons and special actions
    content = content.replace("bg-gradient-to-r from-indigo-500 to-purple-600", "bg-[#0F4C81] hover:bg-[#0c3e6b] text-white")
    content = content.replace("from-indigo-500 to-purple-600", "bg-[#0F4C81] hover:bg-[#0c3e6b]")
    content = content.replace("from-indigo-600 to-purple-700", "bg-[#0F4C81] hover:bg-[#0c3e6b]")
    content = content.replace("bg-indigo-600", "bg-[#0F4C81]")
    content = content.replace("hover:bg-indigo-500", "hover:bg-[#0c3e6b]")
    content = content.replace("hover:bg-indigo-950/20", "hover:bg-slate-50")
    
    # Cancel / Reset buttons: border-indigo-900 text-indigo-400 hover:bg-indigo-950/20 hover:text-white
    content = content.replace("border-indigo-900 text-[#0F4C81]", "border-slate-300 text-slate-700")
    
    # Let's fix specific file details
    if "RequestWizard.tsx" in file_path:
        # Step indicator
        content = content.replace("bg-slate-900 border-indigo-950 text-[#0F4C81]", "bg-slate-100 border-slate-200 text-slate-400")
        content = content.replace('step > item.num ? "bg-indigo-600" : "bg-indigo-950"', 'step > item.num ? "bg-[#0F4C81]" : "bg-slate-200"')
        content = content.replace('step >= item.num ? "text-white" : "text-indigo-400"', 'step >= item.num ? "text-[#0F4C81] font-bold" : "text-slate-400"')
        # Form titles & inputs
        content = content.replace("text-white mb-2", "text-slate-900 mb-2")
        content = content.replace("bg-slate-950 border border-indigo-900/60 rounded-xl text-sm text-white", "bg-white border border-slate-200 rounded-xl text-sm text-slate-800")
        content = content.replace("bg-slate-950 border border-indigo-900/60 rounded-xl text-xs text-white", "bg-white border border-slate-200 rounded-xl text-xs text-slate-800")
        content = content.replace("focus:border-indigo-500", "focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81]")
        content = content.replace("bg-slate-950 border-indigo-900/40 text-[#0F4C81]", "bg-white border-slate-200 text-slate-700")
        content = content.replace("bg-indigo-600/20 border-indigo-500 text-white", "bg-[#0F4C81] border-[#0F4C81] text-white")
        content = content.replace("bg-slate-950 border-indigo-900/40 text-indigo-400", "bg-white border-slate-200 text-slate-500")
        content = content.replace("text-indigo-400/50 cursor-not-allowed", "text-slate-400 cursor-not-allowed")

    # Save refactored content
    with open(abs_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Refactored: {file_path}")

for f in files_to_refactor:
    refactor_file(f)
