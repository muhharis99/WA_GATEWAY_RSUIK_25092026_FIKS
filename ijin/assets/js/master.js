$(function () {
    var table = null;
    var filterTimer = null;
    var filterSubmitting = false;

    function normalizeHistoryDate() {
        var rawDate = $.trim($('#tglKirim').val() || '');

        if (!rawDate) {
            return '';
        }

        var parts = rawDate.split('-');

        if (parts.length === 3 && parts[0].length === 2) {
            return parts[2] + '-' + parts[1] + '-' + parts[0];
        }

        return rawDate;
    }

    function getFilters() {
        return {
            no_reg: $.trim($('#noReg').val() || ''),
            no_telp: $.trim($('#noTelp').val() || ''),
            poli: $.trim($('#poli').val() || ''),
            nama_dokter: $.trim($('#namaDokter').val() || ''),
            tgl_kirim: normalizeHistoryDate(),
            status: $('#statusKirim').val() || ''
        };
    }

    function reloadHistory(immediate) {
        if (!table || filterSubmitting) {
            return;
        }

        var reload = function () {
            table.ajax.reload(null, true);
        };

        if (immediate) {
            clearTimeout(filterTimer);
            reload();
            return;
        }

        clearTimeout(filterTimer);
        filterTimer = setTimeout(reload, 500);
    }

    function initRemoteSelect2(selector, type, placeholder) {
        $(selector).select2({
            theme: 'bootstrap-5',
            width: '100%',
            allowClear: true,
            placeholder: placeholder,
            minimumInputLength: 0,
            ajax: {
                url: 'filter_options.php',
                dataType: 'json',
                delay: 250,
                cache: true,
                data: function (params) {
                    return {
                        type: type,
                        q: params.term || ''
                    };
                },
                processResults: function (data) {
                    return {
                        results: data.results || []
                    };
                }
            },
            language: {
                searching: function () {
                    return 'Mencari...';
                },
                noResults: function () {
                    return 'Data tidak ditemukan';
                }
            }
        }).on('change.autoFilter', function () {
            reloadHistory(true);
        });
    }

    initRemoteSelect2('#poli', 'poli', 'Semua Poli');
    initRemoteSelect2('#namaDokter', 'dokter', 'Semua Dokter');

    $('#statusKirim').select2({
        theme: 'bootstrap-5',
        width: '100%',
        allowClear: true,
        placeholder: 'Semua Status',
        minimumResultsForSearch: Infinity
    }).on('change.autoFilter', function () {
        reloadHistory(true);
    });

    var historyPicker = flatpickr('#tglKirim', {
        dateFormat: 'd-m-Y',
        locale: 'id',
        allowInput: true,
        clickOpens: true,
        disableMobile: true,
        position: 'auto',
        onChange: function () {
            reloadHistory(true);
        }
    });

    $('#tglKirim').on('change.autoFilter', function () {
        reloadHistory(true);
    });

    $('#noReg, #noTelp')
        .off('.autoFilter')
        .on('input.autoFilter', function () {
            reloadHistory(false);
        })
        .on('keydown.autoFilter', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                reloadHistory(true);
            }
        });

    $('#btnReset').on('click', function () {
        clearTimeout(filterTimer);

        $('#noReg, #noTelp, #tglKirim').val('');
        $('#poli, #namaDokter, #statusKirim').val(null).trigger('change.select2');

        if (historyPicker) {
            historyPicker.clear();
        }

        reloadHistory(true);
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
                    $.extend(d, getFilters());
                },
                error: function (xhr, status, errorThrown) {
                    var message = 'Terjadi kesalahan saat mengambil riwayat.';

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
                    last: 'Terakhir',
                    next: 'Berikutnya',
                    previous: 'Sebelumnya'
                }
            }
        });
    }

    initTable();
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
                url: '../api/ijin-send.php',
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
