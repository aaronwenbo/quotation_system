from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, send_file, flash
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime
import pandas as pd

from config import (
    SECRET_KEY, FLASK_HOST, FLASK_PORT, FLASK_DEBUG,
    MAX_CONTENT_LENGTH, ALLOWED_EXTENSIONS, BASIC_AUTH_USERNAME, BASIC_AUTH_PASSWORD,
    UPLOAD_DIR, RESULT_DIR, BACKUP_DIR, LOG_DIR, STANDARD_LIB_PATH, MATCHING_RULES_PATH
)
from quoting_wrapper import QuotingService

app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

quoting_service = QuotingService(str(STANDARD_LIB_PATH), str(MATCHING_RULES_PATH), str(LOG_DIR))


def check_auth(username, password):
    """验证HTTP Basic Auth凭据"""
    return username == BASIC_AUTH_USERNAME and password == BASIC_AUTH_PASSWORD


def authenticate():
    """发送401认证请求"""
    from flask import make_response
    response = make_response('需要认证', 401)
    response.headers['WWW-Authenticate'] = 'Basic realm="Product Quoting System"'
    return response


def requires_auth(f):
    """认证装饰器"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or not check_auth(auth.username, auth.password):
            return authenticate()
        return f(*args, **kwargs)
    return decorated


def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_job_id():
    """生成唯一任务ID"""
    return datetime.now().strftime('%Y%m%d-%H%M%S-') + str(uuid.uuid4())[:8]


@app.route('/')
@requires_auth
def index():
    """首页 - 产品报价"""
    return render_template('index.html')


@app.route('/update')
@requires_auth
def update_library():
    """更新标准库页面"""
    return render_template('update.html')


@app.route('/library')
@requires_auth
def library_status():
    """标准产品库状态页面"""
    df = pd.read_excel(STANDARD_LIB_PATH)
    total_codes = len(df)

    # 获取备份文件列表
    backups = []
    if BACKUP_DIR.exists():
        for backup_file in sorted(BACKUP_DIR.glob("standard_library_backup_*.xlsx"), reverse=True):
            # 解析文件名中的时间戳: standard_library_backup_20260429-153412.xlsx
            name_parts = backup_file.stem.replace('standard_library_backup_', '').split('-')
            if len(name_parts) >= 2:
                date_str = name_parts[0]  # 20260429
                time_str = name_parts[1]  # 153412
                formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]} {time_str[:2]}:{time_str[2:4]}:{time_str[4:6]}"
                backups.append({
                    'filename': backup_file.name,
                    'size': round(backup_file.stat().st_size / 1024, 2),  # KB
                    'formatted_date': formatted_date
                })

    # 获取更新日志
    update_logs = quoting_service.get_update_log(limit=50)

    # 检查是否有来自 /add-to-library 的确认请求待处理
    confirm_code = request.args.get('confirm_code', '')
    confirm_price = request.args.get('confirm_price', '')
    confirm_spec = request.args.get('confirm_spec', '')
    existing_info = None
    if confirm_code:
        # 直接查库确认编码是否存在（GET 请求不应有副作用）
        if quoting_service.lib.has(confirm_code):
            existing_info = {
                'status': 'exists',
                'existing': quoting_service.lib.get(confirm_code)
            }
        else:
            # 编码已被删除，清除确认参数
            confirm_code = ''
            confirm_price = ''
            confirm_spec = ''

    return render_template('library.html',
                          total_codes=total_codes,
                          backups=backups,
                          update_logs=update_logs,
                          confirm_code=confirm_code,
                          confirm_price=confirm_price,
                          confirm_spec=confirm_spec,
                          existing_info=existing_info)


@app.route('/backup-library', methods=['POST'])
@requires_auth
def backup_library():
    """手动备份标准库"""
    try:
        backup_path = quoting_service.backup_library(str(BACKUP_DIR))
        flash(f'标准库已备份成功', 'success')
    except Exception as e:
        flash(f'备份失败: {str(e)}', 'error')
    return redirect(url_for('library_status'))


@app.route('/download-backup/<filename>')
@requires_auth
def download_backup(filename):
    """下载备份文件"""
    # 安全验证
    if '..' in filename or '/' in filename or '\\' in filename:
        flash('非法文件名', 'error')
        return redirect(url_for('library_status'))

    file_path = BACKUP_DIR / filename
    if not file_path.exists():
        flash('备份文件不存在', 'error')
        return redirect(url_for('library_status'))

    return send_file(str(file_path), as_attachment=True)


@app.route('/upload', methods=['POST'])
@requires_auth
def upload_file():
    if 'file' not in request.files:
        flash('没有选择文件', 'error')
        return redirect(url_for('index'))

    file = request.files['file']
    if file.filename == '':
        flash('没有选择文件', 'error')
        return redirect(url_for('index'))

    if not allowed_file(file.filename):
        flash('不支持的文件格式，请上传 .xlsx, .xls, .csv 文件', 'error')
        return redirect(url_for('index'))

    job_id = generate_job_id()
    filename = secure_filename(file.filename)
    safe_filename = f"{job_id}-{filename}"
    file_path = UPLOAD_DIR / safe_filename
    file.save(str(file_path))

    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(file_path, nrows=10)
        else:
            df = pd.read_excel(file_path, nrows=10, header=None)

        columns = list(range(len(df.columns)))
        headers = [f'列 {i}' for i in columns]
        preview_data = df.values.tolist()

        return render_template('index.html',
                              preview=True,
                              headers=headers,
                              preview_data=preview_data,
                              columns=columns,
                              job_id=job_id,
                              filename=safe_filename)
    except Exception as e:
        flash(f'文件读取失败: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/process', methods=['POST'])
@requires_auth
def process_quote():
    job_id = request.form.get('job_id')
    filename = request.form.get('filename')
    code_col = int(request.form.get('code_col'))
    qty_col = int(request.form.get('qty_col'))
    use_markup = request.form.get('use_markup') == 'on'
    markup_percent = float(request.form.get('markup_percent', 0) or 0) if use_markup else 0

    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        flash('文件不存在', 'error')
        return redirect(url_for('index'))

    try:
        df, stats, no_match_codes = quoting_service.process_quote(
            str(file_path), code_col, qty_col, markup_percent)

        result_filename = f"{job_id}-result.xlsx"
        result_path = RESULT_DIR / result_filename
        # 使用带样式的保存方法
        quoting_service.save_styled_quote(df, str(result_path), code_col, qty_col)

        return render_template('result.html',
                              stats=stats,
                              no_match_codes=no_match_codes,
                              qty_warnings=stats.get('qty_warnings', []),
                              result_filename=result_filename)
    except Exception as e:
        flash(f'处理失败: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/download/<filename>')
@requires_auth
def download_result(filename):
    # 安全验证：防止路径遍历攻击
    if '..' in filename or '/' in filename or '\\' in filename:
        flash('非法文件名', 'error')
        return redirect(url_for('index'))

    file_path = RESULT_DIR / filename
    if not file_path.exists():
        flash('文件不存在', 'error')
        return redirect(url_for('index'))
    return send_file(str(file_path), as_attachment=True)


@app.route('/upload-update', methods=['POST'])
@requires_auth
def upload_for_update():
    if 'file' not in request.files:
        flash('没有选择文件', 'error')
        return redirect(url_for('update_library'))

    file = request.files['file']
    if file.filename == '':
        flash('没有选择文件', 'error')
        return redirect(url_for('update_library'))

    if not allowed_file(file.filename):
        flash('不支持的文件格式', 'error')
        return redirect(url_for('update_library'))

    job_id = generate_job_id()
    filename = secure_filename(file.filename)
    safe_filename = f"{job_id}-{filename}"
    file_path = UPLOAD_DIR / safe_filename
    file.save(str(file_path))

    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(file_path, nrows=10)
        else:
            df = pd.read_excel(file_path, nrows=10, header=None)

        columns = list(range(len(df.columns)))
        headers = [f'列 {col} (A=0, B=1, C=2...)' for col in columns]
        preview_data = df.values.tolist()

        return render_template('update.html',
                              preview=True,
                              headers=headers,
                              preview_data=preview_data,
                              columns=columns,
                              job_id=job_id,
                              filename=safe_filename)
    except Exception as e:
        flash(f'文件读取失败: {str(e)}', 'error')
        return redirect(url_for('update_library'))


@app.route('/process-update', methods=['POST'])
@requires_auth
def process_update():
    job_id = request.form.get('job_id')
    filename = request.form.get('filename')
    code_col = int(request.form.get('code_col'))
    price_col = int(request.form.get('price_col'))
    label_col = int(request.form.get('label_col'))

    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        flash('文件不存在', 'error')
        return redirect(url_for('update_library'))

    try:
        quoting_service.backup_library(str(BACKUP_DIR))
        added, skipped = quoting_service.update_library(str(file_path), code_col, price_col, label_col)

        return render_template('update_result.html',
                              added_count=len(added),
                              skipped_count=len(skipped),
                              added=added,
                              skipped=skipped)
    except Exception as e:
        flash(f'更新失败: {str(e)}', 'error')
        return redirect(url_for('update_library'))


@app.route('/add-to-library', methods=['POST'])
@requires_auth
def add_to_library():
    """手动添加产品到标准库"""
    code = request.form.get('code', '').strip()
    price = request.form.get('price', '').strip()
    spec = request.form.get('spec', '').strip()
    force = request.form.get('force', '0') == '1'

    if not code:
        flash('请输入产品编码', 'error')
        return redirect(url_for('library_status'))

    if not price:
        flash('请输入价格', 'error')
        return redirect(url_for('library_status'))

    try:
        price_val = float(price)
    except (ValueError, TypeError):
        flash('价格格式无效，请输入数字', 'error')
        return redirect(url_for('library_status'))

    try:
        result = quoting_service.add_product(code, price_val, spec, force=force)

        if result['status'] == 'added':
            flash(result['message'], 'success')
            return redirect(url_for('library_status'))

        elif result['status'] == 'updated':
            # force=1 时先备份再替换
            quoting_service.backup_library(str(BACKUP_DIR))
            flash(result['message'], 'success')
            return redirect(url_for('library_status'))

        elif result['status'] == 'exists':
            # 编码已存在，重定向回 library 页面并带上待确认参数
            return redirect(url_for('library_status',
                                    confirm_code=code,
                                    confirm_price=price,
                                    confirm_spec=spec))

        else:
            flash(result.get('message', '操作失败'), 'error')
            return redirect(url_for('library_status'))

    except Exception as e:
        flash(f'操作失败: {str(e)}', 'error')
        return redirect(url_for('library_status'))


if __name__ == '__main__':
    print("=" * 60)
    print("产品报价系统启动中...")
    print(f"访问地址: http://{FLASK_HOST}:{FLASK_PORT}")
    print(f"用户名: {BASIC_AUTH_USERNAME}")
    print(f"密码: {BASIC_AUTH_PASSWORD}")
    print("=" * 60)
    app.run(host=FLASK_HOST, port=FLASK_PORT, debug=FLASK_DEBUG)
