'use strict';

class IjinRepository {
  constructor(pool) { this.pool = pool; }
  updateStatus(noHp, status) {
    return new Promise((resolve, reject) => {
      this.pool.query(
        'UPDATE batal_praktek_detil_wa SET status = ? WHERE no_hp = ?',
        [status, noHp],
        (error, result) => error ? reject(error) : resolve(result)
      );
    });
  }
  close() { return new Promise((resolve) => this.pool.end(() => resolve())); }
}
module.exports = IjinRepository;
