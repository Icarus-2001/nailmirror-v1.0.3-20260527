import json, openpyxl, sys, os
data_dir = sys.argv[1]
xlsx = [f for f in os.listdir(data_dir) if f.endswith('.xlsx')][0]
wb = openpyxl.load_workbook(os.path.join(data_dir, xlsx), read_only=True, data_only=True)
ws = wb[wb.sheetnames[1]]
rows = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if row and row[0] and row[2]:
        rows.append({"idx": row[0], "orig": row[1], "enhanced": row[2]})
print(json.dumps(rows, ensure_ascii=False))
