import re
from datetime import datetime
from django.utils import timezone

def validate_passport_number(passport_num: str) -> bool:
    """
    Validates general international passport number pattern (alphanumeric, 7-9 characters).
    """
    if not passport_num:
        return False
    # Standard format: Alphanumeric and length between 6 to 12 characters
    pattern = r"^[A-Z0-9]{6,12}$"
    return bool(re.match(pattern, passport_num.upper().replace(" ", "")))

def validate_emirates_id(eid: str) -> bool:
    """
    Validates UAE Emirates ID format and check-digit.
    Format: 784-YYYY-XXXXXXX-Z
    E.g. 784-1992-1234567-3
    """
    if not eid:
        return False
    
    # Strip any spaces or hyphens for calculation
    clean_id = eid.replace("-", "").replace(" ", "")
    
    if len(clean_id) != 15:
        return False
    
    if not clean_id.startswith("784"):
        return False
    
    # Weighted checksum validation (Luhn-like algorithm for Emirates ID check digit)
    # Weights for EID check digit validation
    weights = [3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1]
    digits = [int(d) for d in clean_id[:-1]]
    check_digit = int(clean_id[-1])
    
    weighted_sum = sum(w * d for w, d in zip(weights, digits))
    calculated_check = weighted_sum % 10
    
    return calculated_check == check_digit

def check_document_expiry(expiry_date_str: str) -> dict:
    """
    Checks if a document date has expired.
    Accepts standard YYYY-MM-DD or DD/MM/YYYY formats.
    Returns dict: {"expired": bool, "parsed_date": date|None, "flag": str|None}
    """
    if not expiry_date_str:
        return {"expired": True, "parsed_date": None, "flag": "expiry_date_missing"}
        
    date_formats = ["%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y", "%d %b %Y"]
    parsed_date = None
    
    for fmt in date_formats:
        try:
            parsed_date = datetime.strptime(expiry_date_str.strip(), fmt).date()
            break
        except ValueError:
            continue
            
    if not parsed_date:
        return {"expired": True, "parsed_date": None, "flag": "invalid_date_format"}
        
    today = timezone.now().date()
    expired = parsed_date <= today
    
    return {
        "expired": expired,
        "parsed_date": parsed_date,
        "flag": "document_expired" if expired else None
    }

def run_comprehensive_validation(doc_type: str, fields: dict) -> tuple:
    """
    Runs type-specific validations over extracted fields.
    Returns:
        status (str): 'valid' | 'invalid' | 'manual_review_required'
        flags (List[str]): validation warning tags
    """
    flags = []
    
    # 1. Base check: check for empty values in mandatory fields
    mandatory_fields = {
        'passport': ['full_name', 'document_number', 'nationality', 'expiry_date'],
        'emirates_id': ['full_name', 'document_number', 'expiry_date'],
        'visa': ['full_name', 'document_number', 'expiry_date']
    }
    
    fields_to_check = mandatory_fields.get(doc_type, [])
    for field in fields_to_check:
        val = fields.get(field)
        if not val or str(val).strip() == "":
            flags.append(f"{field}_missing")
            
    # 2. Expiry validation
    expiry_val = check_document_expiry(fields.get('expiry_date'))
    if expiry_val["flag"]:
        flags.append(expiry_val["flag"])
    elif expiry_val["expired"]:
        flags.append("document_expired")
        
    # 3. Type-specific format checks
    if doc_type == 'passport':
        doc_num = fields.get('document_number')
        if doc_num and not validate_passport_number(doc_num):
            flags.append("invalid_passport_format")
            
    elif doc_type == 'emirates_id':
        doc_num = fields.get('document_number')
        if doc_num and not validate_emirates_id(doc_num):
            flags.append("invalid_emirates_id_checksum")
            
    # Determine final status
    status = 'valid'
    if any(f in flags for f in ["document_expired", "invalid_emirates_id_checksum", "invalid_passport_format"]):
        status = 'invalid'
    elif flags: # Some missing non-critical or formatting flags
        status = 'manual_review_required'
        
    # Check OCR confidence score
    confidence = float(fields.get('ocr_confidence', 1.0))
    if confidence < 0.70:
        status = 'manual_review_required'
        flags.append("low_ocr_confidence")
        
    return status, flags
