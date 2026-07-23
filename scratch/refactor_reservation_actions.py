import os

def refactor_reservation():
    path = r"e:\visit\src\app\actions\reservation.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add auth imports
    auth_imports = """
import { 
  verifyHostSession, 
  verifySecuritySession, 
  establishSession, 
  destroySession, 
  getSessionEmail 
} from "@/lib/auth";
"""
    if "verifyHostSession" not in content:
        content = content.replace('import prisma from "@/lib/prisma";', 'import prisma from "@/lib/prisma";' + auth_imports)

    # 2. Add logout action
    logout_fn = """
export async function logout() {
  await destroySession();
  return { success: true };
}
"""
    if "export async function logout()" not in content:
      content += logout_fn

    # 3. Refactor getHostReservations
    old_get_host_res = """export async function getHostReservations(hostEmail: string) {
  if (!hostEmail) return { success: false, error: "이메일 주소가 누락되었습니다." };
  try {"""
    new_get_host_res = """export async function getHostReservations(hostEmail: string) {
  if (!hostEmail) return { success: false, error: "이메일 주소가 누락되었습니다." };
  try {
    await verifyHostSession(hostEmail);"""
    content = content.replace(old_get_host_res, new_get_host_res)

    # 4. Refactor getSecurityReservations
    old_get_sec_res = """export async function getSecurityReservations(query?: string) {
  try {"""
    new_get_sec_res = """export async function getSecurityReservations(query?: string) {
  try {
    await verifySecuritySession();"""
    content = content.replace(old_get_sec_res, new_get_sec_res)

    # 5. Refactor verifyHostToken to establish session
    old_verify_host = """    if (!secToken) {
      return { success: false, error: "만료되었거나 유효하지 않은 보안 로그인 링크입니다." };
    }
    return { success: true };"""
    new_verify_host = """    if (!secToken) {
      return { success: false, error: "만료되었거나 유효하지 않은 보안 로그인 링크입니다." };
    }
    await establishSession(token);
    return { success: true };"""
    content = content.replace(old_verify_host, new_verify_host)

    # 6. Refactor verifySecurityToken to establish session
    old_verify_sec = """    if (!secToken) {
      return { success: false, error: "만료되었거나 유효하지 않은 보안 로그인 링크입니다." };
    }
    return { success: true };"""
    new_verify_sec = """    if (!secToken) {
      return { success: false, error: "만료되었거나 유효하지 않은 보안 로그인 링크입니다." };
    }
    await establishSession(token);
    return { success: true };"""
    content = content.replace(old_verify_sec, new_verify_sec)

    # 7. Refactor checkInVisitor
    old_checkin = """export async function checkInVisitor(
  id: string,
  temporaryCardNumber: string,
  idCardKept: boolean,
  deviceSealed: boolean
) {
  if (!id) return { success: false, error: "예약 ID가 누락되었습니다." };
  if (!temporaryCardNumber) return { success: false, error: "임시출입카드 발급 번호를 입력해 주십시오." };
  
  try {"""
    new_checkin = """export async function checkInVisitor(
  id: string,
  temporaryCardNumber: string,
  idCardKept: boolean,
  deviceSealed: boolean
) {
  if (!id) return { success: false, error: "예약 ID가 누락되었습니다." };
  if (!temporaryCardNumber) return { success: false, error: "임시출입카드 발급 번호를 입력해 주십시오." };
  
  try {
    await verifySecuritySession();"""
    content = content.replace(old_checkin, new_checkin)

    # 8. Refactor checkOutVisitor
    old_checkout = """export async function checkOutVisitor(id: string) {
  if (!id) return { success: false, error: "예약 ID가 누락되었습니다." };
  
  try {"""
    new_checkout = """export async function checkOutVisitor(id: string) {
  if (!id) return { success: false, error: "예약 ID가 누락되었습니다." };
  
  try {
    await verifySecuritySession();"""
    content = content.replace(old_checkout, new_checkout)

    # 9. Refactor getMonthlyReservations
    old_monthly = """export async function getMonthlyReservations(year: number, month: number) {
  try {"""
    new_monthly = """export async function getMonthlyReservations(year: number, month: number) {
  try {
    await verifySecuritySession();"""
    content = content.replace(old_monthly, new_monthly)

    # 10. Refactor updateReservationStatus
    old_update = """export async function updateReservationStatus(id: string, status: ReservationStatus) {
  if (!id || !status) {
    throw new Error("ID 또는 변경할 상태가 누락되었습니다.");
  }
  
  try {"""
    new_update = """export async function updateReservationStatus(id: string, status: ReservationStatus) {
  if (!id || !status) {
    throw new Error("ID 또는 변경할 상태가 누락되었습니다.");
  }
  
  try {
    const userEmail = await getSessionEmail();
    if (!userEmail) {
      throw new Error("인증 세션이 만료되었습니다. 다시 로그인하십시오.");
    }
    const currentRes = await prisma.reservation.findUnique({
      where: { id }
    });
    if (!currentRes) {
      throw new Error("해당 예약을 찾을 수 없습니다.");
    }
    if (currentRes.hostEmail.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
      throw new Error("본인이 담당하는 예약만 승인/반려할 수 있습니다.");
    }"""
    content = content.replace(old_update, new_update)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Refactored reservation.ts with security checks")

refactor_reservation()
