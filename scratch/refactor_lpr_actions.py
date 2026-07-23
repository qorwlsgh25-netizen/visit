import os

def refactor_lpr():
    path = r"e:\visit\src\app\actions\lpr.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add auth import
    auth_import = '\nimport { verifySecuritySession } from "@/lib/auth";\n'
    if "verifySecuritySession" not in content:
        content = content.replace('import prisma from "@/lib/prisma";', 'import prisma from "@/lib/prisma";' + auth_import)

    # 2. Refactor getEmployeeVehicles
    content = content.replace("export async function getEmployeeVehicles() {\n  try {", "export async function getEmployeeVehicles() {\n  try {\n    await verifySecuritySession();")

    # 3. Refactor addEmployeeVehicle
    content = content.replace("  try {\n    // 중복 전화번호 체크", "  try {\n    await verifySecuritySession();\n    // 중복 전화번호 체크")

    # 4. Refactor deleteEmployeeVehicle
    content = content.replace("export async function deleteEmployeeVehicle(id: string) {\n  try {", "export async function deleteEmployeeVehicle(id: string) {\n  try {\n    await verifySecuritySession();")

    # 5. Refactor getRotationViolations
    content = content.replace("export async function getRotationViolations() {\n  try {", "export async function getRotationViolations() {\n  try {\n    await verifySecuritySession();")

    # 6. Refactor deleteRotationViolation
    content = content.replace("export async function deleteRotationViolation(id: string) {\n  try {", "export async function deleteRotationViolation(id: string) {\n  try {\n    await verifySecuritySession();")

    # 7. Refactor updateEmployeeVehicle
    content = content.replace("  try {\n    // 중복 전화번호 체크 (본인 제외)", "  try {\n    await verifySecuritySession();\n    // 중복 전화번호 체크 (본인 제외)")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Refactored lpr.ts with security checks")

refactor_lpr()
