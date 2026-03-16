import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';

// MySQL连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'quotation_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let sqliteDb = null;

// 获取数据库连接池
export function getPool() {
  if (process.env.DB_TYPE === 'sqlite') {
    return sqliteDb;
  }
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// 初始化数据库
export async function initDatabase() {
  if (process.env.DB_TYPE === 'sqlite') {
    return initSqlite();
  }

  // MySQL 初始化逻辑 (保持不变)
  const tempConnection = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password
  });

  await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await tempConnection.end();

  const pool = getPool();
  await createTablesMySQL(pool);
  console.log('MySQL 数据库初始化完成');
}

async function initSqlite() {
  // 我们将动态导入 sqlite3 以避免在非桌面环境下出错
  const sqlite3 = (await import('sqlite3')).default;
  const { open } = await import('sqlite');
  
  const dbPath = path.join(process.cwd(), 'database.db');
  sqliteDb = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // 模拟 mysql2 的 execute 接口
  const originalExecute = sqliteDb.run.bind(sqliteDb);
  sqliteDb.execute = async (sql, params) => {
    // 处理 MySQL 到 SQLite 的一些基本语法差异
    let finalSql = sql
      .replace(/AUTO_INCREMENT/gi, 'AUTOINCREMENT')
      .replace(/INT/gi, 'INTEGER')
      .replace(/JSON/gi, 'TEXT')
      .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/gi, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
      .replace(/CHARACTER SET \w+/gi, '')
      .replace(/COLLATE \w+/gi, '')
      .replace(/ENGINE=InnoDB/gi, '');
    
    // 我们的 SQL 主要是 CREATE TABLE，如果是查询则使用 all/get
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const rows = await sqliteDb.all(sql, params);
      return [rows];
    } else {
      const result = await sqliteDb.run(finalSql, params);
      return [result];
    }
  };

  await createTablesSqlite(sqliteDb);
  console.log('SQLite 数据库初始化完成: ' + dbPath);
}

async function createTablesMySQL(pool) {
  // 原有的 MySQL 建表语句
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_code VARCHAR(50) UNIQUE NOT NULL,
      name_cn VARCHAR(200) NOT NULL,
      name_en VARCHAR(200),
      category VARCHAR(100),
      specifications JSON,
      unit VARCHAR(20) DEFAULT '个',
      cost_price DECIMAL(10,2) DEFAULT 0,
      base_price DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_product_code (product_code),
      INDEX idx_name_cn (name_cn)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      contact_person VARCHAR(100),
      phone VARCHAR(50),
      email VARCHAR(100),
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS quotation_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      prices JSON,
      is_default TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quotation_no VARCHAR(50) UNIQUE NOT NULL,
      customer_id INT,
      template_id INT,
      status VARCHAR(20) DEFAULT 'draft',
      valid_until DATE,
      discount_rate DECIMAL(5,2) DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (template_id) REFERENCES quotation_templates(id) ON DELETE SET NULL,
      INDEX idx_quotation_no (quotation_no),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quotation_id INT NOT NULL,
      product_id INT,
      product_code VARCHAR(50),
      product_name VARCHAR(200),
      quantity INT DEFAULT 1,
      unit_price DECIMAL(10,2) DEFAULT 0,
      cost_price DECIMAL(10,2) DEFAULT 0,
      discount DECIMAL(5,2) DEFAULT 0,
      amount DECIMAL(12,2) DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      quotation_id INT NOT NULL,
      customer_id INT,
      unit_price DECIMAL(10,2) NOT NULL,
      quantity INT DEFAULT 1,
      quoted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      INDEX idx_product_quoted (product_id, quoted_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function createTablesSqlite(db) {
  // SQLite 兼容的建表语句
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE NOT NULL,
      name_cn TEXT NOT NULL,
      name_en TEXT,
      category TEXT,
      specifications TEXT,
      unit TEXT DEFAULT '个',
      cost_price REAL DEFAULT 0,
      base_price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS quotation_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      prices TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_no TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      template_id INTEGER,
      status TEXT DEFAULT 'draft',
      valid_until DATE,
      discount_rate REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (template_id) REFERENCES quotation_templates(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      product_id INTEGER,
      product_code TEXT,
      product_name TEXT,
      quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quotation_id INTEGER NOT NULL,
      customer_id INTEGER,
      unit_price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      quoted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )
  `);
}

export default { getPool, initDatabase };
