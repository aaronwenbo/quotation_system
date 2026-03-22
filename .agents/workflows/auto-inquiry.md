---
description: Automatically process a customer inquiry letter, generate a quotation, and report any mismatched items
---

# Auto Quotation Generator Skill

When I send you a customer's inquiry letter (either as raw text or a document), follow these exact steps to complete the quotation flow automatically:

1. **Extract Inquiry Information**:
   - Parse the raw text of the customer inquiry.
   - Extract a list of requested items. You MUST identify the "Product Name/Code" and the "Quantity".
   - Convert this extracted list into a clean JSON array structure:
     `[ { "name": "Item Description", "quantity": 10 }, ... ]`

2. **Save to a Temporary File**:
   - Save the extracted JSON array into a temporary file at `/tmp/ai_inquiry.json`.

// turbo
3. **Execute the Auto Quote Node Script**:
   - Run the automatic quotation creation script we have prepared in the server directory, specifically tailored for your AI capabilities:
     ```bash
     cd e:\mogu\quotation_system\server
     node scripts/ai_auto_quote.js /tmp/ai_inquiry.json
     ```
   
4. **Analyze the JSON Output**:
   - The script will output a JSON response containing `matched`, `unmatched`, `quotation_no`, and `total`. Read this output carefully.

5. **Generate the Final Report to the User**:
   - **Step 1 (Success)**: If a `quotation_no` was successfully generated, tell me the Quotation Number and the subtotal so I know a Draft quote is sitting in my system!
   - **Step 2 (Identify Issues)**: If there are ANY `unmatched` items, present them to me in a clear markdown list. Explain that these particular items could not be found in our product database or alias table.
   - **Step 3 (Call to Action)**: Remind me that I can go to the **产品别名管理** (Product Alias Management) page or visually handle them via the standard manual import queue to map these unknown aliases properly!
