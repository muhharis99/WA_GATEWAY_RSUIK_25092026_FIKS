$(function () {
    let table = null;

    flatpickr('#tglKirim', {
        dateFormat: 'd-m-Y',
        locale: 'id',
        disableMobile: true
    });

    function statusLabel(value) {
        if (value === '1') return 'Terkirim';
        if (value === '2') return 'Gagal Kirim';
        return 'N/A';
    }

    function statusBadge(value) {
        if (value === '1') {
            return '<span class="badge text-bg-success">Terkirim</span>';
        }

        if (value === '2') {
            return '<span class="badge text-bg-danger">Gagal Kirim</span>';
        }

        return '<span class="badge text-bg-secondary">N/A</span>';
    }

    function getFilters() {
        const rawDate = $('#tglKirim').val().trim();
        let dateValue = rawDate;

        if (rawDate) {
            const parts = rawDate.split('-');

            if (parts.length === 3 && parts[0].length === 2) {
                dateValue = parts[2] + '-' + parts[1] + '-' + parts[0];
            }
        }

        return {
            no_reg: $('#noReg').val().trim(),
            no_telp: $('#noTelp').val().trim(),
            poli: $('#poli').val().trim(),
            nama_dokter: $('#namaDokter').val().trim(),
            tgl_kirim: dateValue,
            status: $('#statusKirim').val()
        };
    }

    function initTable() {
        if (table) return;

        table = $('#TblBtlKirim').DataTable({
            processing: true,
            serverSide: true,
            responsive: true,
            deferRender: true,
            pageLength: 25,
            lengthMenu: [10, 25, 50, 100],
            order: [],
            ajax: {
                url: 'ajax_riwayat.php',
                type: 'POST',
                data: function (d) {
                    Object.assign(d, getFilters());
                },
                error: function (xhr, status, errorThrown) {
                    let message = 'Terjadi kesalahan saat mengambil riwayat.';

                    if (xhr.responseJSON && xhr.responseJSON.detail) {
                        message =
                            (xhr.responseJSON.error || 'PHP Error') +
                            '\n\n' +
                            xhr.responseJSON.detail;

                        if (xhr.responseJSON.file) {
                            message +=
                                '\n\nFile: ' +
                                xhr.responseJSON.file +
                                ':' +
                                (xhr.responseJSON.line || '?');
                        }
                    } else if (xhr.responseJSON && xhr.responseJSON.error) {
                        message = xhr.responseJSON.error;
                    } else if (status === 'timeout') {
                        message = 'Request riwayat timeout. Database terlalu lambat atau service belum merespons.';
                    } else if (xhr.status) {
                        message = 'HTTP ' + xhr.status + ' - ' + (errorThrown || status || 'Unknown error');
                    }

                    console.error('IJIN ajax_riwayat error:', {
                        status: xhr.status,
                        textStatus: status,
                        error: errorThrown,
                        response: xhr.responseText
                    });

                    Swal.fire({
                        icon: 'error',
                        title: 'Gagal Memuat Riwayat',
                        text: message,
                        confirmButtonColor: '#389f6a'
                    });
                }
            },
            columnDefs: [
                { targets: [0, 1, 4, 6, 7], className: 'text-nowrap' },
                { targets: 3, width: '28%' }
            ],
            language: {
                search: 'Cari:',
                lengthMenu: 'Tampilkan _MENU_ data',
                info: 'Menampilkan _START_ sampai _END_ dari _TOTAL_ data',
                infoEmpty: 'Tidak ada data',
                infoFiltered: '(difilter dari _MAX_ data)',
                zeroRecords: 'Data tidak ditemukan',
                emptyTable: 'Belum ada riwayat pengiriman',
                processing: 'Memuat data...',
                paginate: {
                    first: 'Awal',
                    last: 'Akhir',
                    next: 'Berikutnya',
                    previous: 'Sebelumnya'
                }
            }
        });
    }

    initTable();

    $('#btnCari').on('click', function () {
        table.ajax.reload(null, true);
    });

    $('#btnReset').on('click', function () {
        $('#noReg, #noTelp, #poli, #namaDokter, #tglKirim').val('');
        $('#statusKirim').val('');
        table.ajax.reload(null, true);
    });

    $('#historyFilterForm input').on('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            table.ajax.reload(null, true);
        }
    });

    $('#statusKirim').on('change', function () {
        table.ajax.reload(null, true);
    });

    $('#editMessage').on('click', function () {
        $('#message').prop('readonly', false).trigger('focus');
        $('#editMessage').addClass('d-none');
        $('#cancelEdit').removeClass('d-none');
    });

    $('#cancelEdit').on('click', function () {
        $('#message').prop('readonly', true);
        $('#editMessage').removeClass('d-none');
        $('#cancelEdit').addClass('d-none');
    });

    $('#whatsappForm').on('submit', function (event) {
        event.preventDefault();

        const numbers = $('#numbers').val().trim();
        const message = $('#message').val().trim();

        if (!numbers || !message) {
            Swal.fire({
                icon: 'warning',
                title: 'Data Belum Lengkap',
                text: 'Nomor penerima dan pesan wajib diisi.',
                confirmButtonColor: '#389f6a'
            });
            return;
        }

        const list = numbers.split(',').map(v => v.trim()).filter(Boolean);

        Swal.fire({
            icon: 'question',
            title: 'Kirim Notifikasi?',
            html: 'Akan dikirim ke <strong>' + list.length + '</strong> nomor.',
            showCancelButton: true,
            confirmButtonText: 'Ya, Kirim',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#389f6a',
            cancelButtonColor: '#6c757d',
            reverseButtons: true
        }).then(function (result) {
            if (!result.isConfirmed) return;

            const button = $('#whatsappForm button[type="submit"]');

            button.prop('disabled', true).text('Mengirim...');

            Swal.fire({
                title: 'Mengirim Notifikasi',
                text: 'Mohon tunggu sampai proses selesai.',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: function () {
                    Swal.showLoading();
                }
            });

            $.ajax({
                url: '../services/ijin/api-send.php',
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                timeout: 600000,
                data: JSON.stringify({
                    numbers: numbers,
                    message: message
                })
            })
            .done(function (result) {
                const items = Array.isArray(result.data) ? result.data : [];
                const berhasil = items.filter(item => String(item.status) === '1').length;
                const gagal = items.filter(item => String(item.status) === '2').length;

                Swal.fire({
                    icon: gagal > 0 ? 'warning' : 'success',
                    title: 'Pengiriman Selesai',
                    html:
                        '<div>Berhasil: <strong>' + berhasil + '</strong></div>' +
                        '<div>Gagal: <strong>' + gagal + '</strong></div>',
                    confirmButtonColor: '#389f6a'
                }).then(function () {
                    window.location.reload();
                });
            })
            .fail(function (xhr, status) {
                const message =
                    xhr.responseJSON && xhr.responseJSON.message
                        ? xhr.responseJSON.message
                        : status === 'timeout'
                            ? 'Request timeout. Server mungkin masih memproses.'
                            : 'Terjadi kesalahan saat mengirim notifikasi.';

                Swal.fire({
                    icon: 'error',
                    title: 'Pengiriman Gagal',
                    text: message,
                    confirmButtonColor: '#d9534f'
                });
            })
            .always(function () {
                button.prop('disabled', false).text('Kirim Sekarang');
            });
        });
    });
});
