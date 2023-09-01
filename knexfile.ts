import 'dotenv/config'

const {
  DB_CLIENT,
  DB_DATABASE,
  DB_USERNAME,
  DB_PASSWORD
} = process.env

const params = DB_CLIENT === 'sqlite3'
  ? {
      filename: DB_DATABASE
    }
  : {
      database: DB_DATABASE,
      user: DB_USERNAME,
      password: DB_PASSWORD
    }

export default {
  client: DB_CLIENT,
  connection: params,
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'migrations'
  },
  useNullAsDefault: DB_CLIENT === 'sqlite3'
}
