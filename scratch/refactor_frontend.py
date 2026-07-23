import os

def refactor_host_dashboard():
    path = r"e:\visit\src\app\host\dashboard\page.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Import logout
    content = content.replace("updateReservationStatus \n} from \"@/app/actions/reservation\";", "updateReservationStatus,\n  logout\n} from \"@/app/actions/reservation\";")
    content = content.replace("updateReservationStatus \r\n} from \"@/app/actions/reservation\";", "updateReservationStatus,\n  logout\n} from \"@/app/actions/reservation\";")
    content = content.replace("updateReservationStatus \n} from '@/app/actions/reservation';", "updateReservationStatus,\n  logout\n} from '@/app/actions/reservation';")
    content = content.replace("updateReservationStatus \r\n} from '@/app/actions/reservation';", "updateReservationStatus,\n  logout\n} from '@/app/actions/reservation';")

    # Refactor handleLogout
    old_logout = """  const handleLogout = () => {
    sessionStorage.removeItem("host_email");
    setEmail(null);"""
    new_logout = """  const handleLogout = async () => {
    await logout();
    sessionStorage.removeItem("host_email");
    setEmail(null);"""
    content = content.replace(old_logout, new_logout)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Refactored host/dashboard/page.tsx")

def refactor_admin_dashboard():
    path = r"e:\visit\src\app\admin\dashboard\page.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Import logout
    content = content.replace("verifySecurityToken \n} from \"@/app/actions/reservation\";", "verifySecurityToken,\n  logout\n} from \"@/app/actions/reservation\";")
    content = content.replace("verifySecurityToken \r\n} from \"@/app/actions/reservation\";", "verifySecurityToken,\n  logout\n} from \"@/app/actions/reservation\";")
    content = content.replace("verifySecurityToken \n} from '@/app/actions/reservation';", "verifySecurityToken,\n  logout\n} from '@/app/actions/reservation';")
    content = content.replace("verifySecurityToken \r\n} from '@/app/actions/reservation';", "verifySecurityToken,\n  logout\n} from '@/app/actions/reservation';")

    # Refactor handleLogout
    old_logout = """  const handleLogout = () => {
    document.cookie = "security_email=; path=/; max-age=0";
    sessionStorage.removeItem("security_email");
    setEmail(null);"""
    new_logout = """  const handleLogout = async () => {
    await logout();
    document.cookie = "security_email=; path=/; max-age=0";
    sessionStorage.removeItem("security_email");
    setEmail(null);"""
    content = content.replace(old_logout, new_logout)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Refactored admin/dashboard/page.tsx")

def refactor_admin_smtp():
    path = r"e:\visit\src\app\admin\smtp\page.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Refactor getSmtpSetting call to pass token
    content = content.replace("const smtpResult = await getSmtpSetting();", "const smtpResult = await getSmtpSetting(token);")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Refactored admin/smtp/page.tsx")

refactor_host_dashboard()
refactor_admin_dashboard()
refactor_admin_smtp()
