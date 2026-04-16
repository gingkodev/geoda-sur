import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  database: process.env.MYSQL_DATABASE ?? "cardinal",
  user: process.env.MYSQL_USER ?? "cardinal",
  password: process.env.MYSQL_PASSWORD ?? "",
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;
