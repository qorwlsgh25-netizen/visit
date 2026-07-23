import os

def fix_faint_texts():
    # 1. host/dashboard/page.tsx
    host_path = r"e:\visit\src\app\host\dashboard\page.tsx"
    if os.path.exists(host_path):
        with open(host_path, "r", encoding="utf-8") as f:
            content = f.read()
        content = content.replace("text-slate-100", "text-slate-900")
        content = content.replace("text-xl font-bold mt-1 text-white", "text-xl font-bold mt-1 text-slate-900")
        content = content.replace("bg-red-950/40 border border-red-500/20 text-red-400", "bg-red-600 hover:bg-red-700 text-white")
        with open(host_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Fixed host/dashboard/page.tsx")

    # 2. admin/dashboard/page.tsx
    admin_path = r"e:\visit\src\app\admin\dashboard\page.tsx"
    if os.path.exists(admin_path):
        with open(admin_path, "r", encoding="utf-8") as f:
            content = f.read()
        content = content.replace("text-slate-100", "text-slate-900")
        content = content.replace("group-hover:text-white", "group-hover:text-slate-900")
        with open(admin_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Fixed admin/dashboard/page.tsx")

    # 3. admin/webcam/page.tsx
    webcam_path = r"e:\visit\src\app\admin\webcam\page.tsx"
    if os.path.exists(webcam_path):
        with open(webcam_path, "r", encoding="utf-8") as f:
            content = f.read()
        content = content.replace("text-slate-100", "text-slate-900")
        with open(webcam_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Fixed admin/webcam/page.tsx")

    # 4. admin/fiveday/page.tsx
    fiveday_path = r"e:\visit\src\app\admin\fiveday/page.tsx"
    if os.path.exists(fiveday_path):
        with open(fiveday_path, "r", encoding="utf-8") as f:
            content = f.read()
        content = content.replace("text-slate-100", "text-slate-900")
        with open(fiveday_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Fixed admin/fiveday/page.tsx")

fix_faint_texts()
