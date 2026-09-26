'use strict';

function createGatewayController(service) {
  return {
    send: async (req, res) => {
      const { numbers, message } = req.body || {};
      if (typeof numbers !== 'string' || typeof message !== 'string' || !numbers.trim() || !message.trim()) {
        return res.status(400).json({ success: false, message: 'numbers dan message wajib diisi' });
      }
      try {
        const results = await service.send(numbers, message);
        const allSuccess = results.length > 0 && results.every((item) => item.status === 1);
        return res.status(allSuccess ? 200 : 207).json({ success: allSuccess, data: results });
      } catch (error) {
        return res.status(error.statusCode || 500).json({
          success: false,
          message: error.message || 'Gagal mengirim pesan',
          ...(error.state ? { state: error.state } : {})
        });
      }
    },
  };
}
module.exports = { createGatewayController };
