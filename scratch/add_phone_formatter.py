import os

formatter_fn = """
const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\\d]/g, "");
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 8) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  }
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
};
"""

def add_formatter_to_request_wizard():
    path = r"e:\visit\src\app\request\RequestWizard.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Insert formatPhoneNumber helper function after imports
    if "const formatPhoneNumber =" not in content:
        # Find the line const TIME_OPTIONS = generateTimeOptions();
        marker = "const TIME_OPTIONS = generateTimeOptions();"
        content = content.replace(marker, marker + "\n" + formatter_fn)

    # 2. Modify handleInputChange
    old_input_change = """  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };"""
    new_input_change = """  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === "phoneNumber" || name === "hostPhone") {
      formattedValue = formatPhoneNumber(value);
    }
    setForm((prev) => ({ ...prev, [name]: formattedValue }));
  };"""
    content = content.replace(old_input_change, new_input_change)

    # 3. Modify handleCompanionChange
    old_companion_change = """  const handleCompanionChange = (index: number, field: string, value: string) => {
    setCompanions((prev) =>
      prev.map((comp, i) => (i === index ? { ...comp, [field]: value } : comp))
    );
  };"""
    new_companion_change = """  const handleCompanionChange = (index: number, field: string, value: string) => {
    let formattedValue = value;
    if (field === "phoneNumber") {
      formattedValue = formatPhoneNumber(value);
    }
    setCompanions((prev) =>
      prev.map((comp, i) => (i === index ? { ...comp, [field]: formattedValue } : comp))
    );
  };"""
    content = content.replace(old_companion_change, new_companion_change)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Added phone formatter to RequestWizard.tsx")

def add_formatter_to_fiveday():
    path = r"e:\visit\src\app\admin\fiveday\page.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Insert formatPhoneNumber helper function
    if "const formatPhoneNumber =" not in content:
        # Find the line export default function FiveDayRotationPage() {
        marker = "export default function FiveDayRotationPage() {"
        content = content.replace(marker, formatter_fn + "\n" + marker)

    # 2. Modify form input onchanges
    old_form_onchange = 'onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}'
    new_form_onchange = 'onChange={(e) => setForm((prev) => ({ ...prev, phoneNumber: formatPhoneNumber(e.target.value) }))}'
    content = content.replace(old_form_onchange, new_form_onchange)

    old_edit_form_onchange = 'onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}'
    new_edit_form_onchange = 'onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: formatPhoneNumber(e.target.value) }))}'
    content = content.replace(old_edit_form_onchange, new_edit_form_onchange)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Added phone formatter to fiveday/page.tsx")

add_formatter_to_request_wizard()
add_formatter_to_fiveday()
