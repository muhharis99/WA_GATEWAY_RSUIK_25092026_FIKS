(function ($) {
    'use strict';

    var sweetAlertReady = (typeof Swal !== 'undefined')
        ? $.Deferred().resolve(Swal).promise()
        : $.getScript('https://cdn.jsdelivr.net/npm/sweetalert2@11')
            .then(function () {
                return typeof Swal !== 'undefined' ? Swal : null;
            })
            .catch(function () {
                return null;
            });

    function getConfirmationCopy($form) {
        var action = $.trim($form.find('input[name="action"]').val() || '');
        var $submit = $form.find('button[type="submit"], input[type="submit"]').first();
        var submitText = $.trim($submit.text() || $submit.val() || '');
        var source = action + ' ' + submitText;

        if (action === 'disable_contact') {
            return {
                title: 'Nonaktifkan Nomor WhatsApp?',
                text: 'Apakah nomor WhatsApp dokter ini benar akan dinonaktifkan?',
                confirmText: 'Ya, Nonaktifkan',
                confirmColor: '#dc3545'
            };
        }

        if (action === 'save_contact') {
            return {
                title: 'Simpan Nomor WhatsApp?',
                text: 'Pastikan dokter dan nomor WhatsApp yang dipilih sudah benar.',
                confirmText: 'Ya, Simpan',
                confirmColor: '#198754'
            };
        }

        if (/hapus|delete/i.test(source)) {
            return {
                title: 'Hapus Data?',
                text: 'Apakah data benar di hapus? Tindakan ini akan mengubah data pada sistem.',
                confirmText: 'Ya, Hapus',
                confirmColor: '#dc3545'
            };
        }

        if (/nonaktif|disable/i.test(source)) {
            return {
                title: 'Nonaktifkan Data?',
                text: 'Apakah data ini benar akan dinonaktifkan?',
                confirmText: 'Ya, Nonaktifkan',
                confirmColor: '#dc3545'
            };
        }

        if (/aktif|enable/i.test(source)) {
            return {
                title: 'Aktifkan Data?',
                text: 'Apakah data ini benar akan diaktifkan?',
                confirmText: 'Ya, Aktifkan',
                confirmColor: '#198754'
            };
        }

        return {
            title: 'Simpan Perubahan?',
            text: 'Pastikan data yang diisi sudah benar sebelum melanjutkan.',
            confirmText: 'Ya, Simpan',
            confirmColor: '#198754'
        };
    }

    function submitConfirmed($form) {
        $form.data('confirmedSubmit', '1').trigger('submit');
    }

    function initFormConfirmation() {
        $('form').each(function () {
            var $form = $(this);
            var method = ($form.attr('method') || 'get').toLowerCase();

            if (method !== 'post' || $form.data('swalConfirmation') === 'off') {
                return;
            }

            $form.find('[onclick*="confirm("]').removeAttr('onclick');

            $form.off('submit.appConfirmation').on('submit.appConfirmation', function (event) {
                if ($form.data('confirmedSubmit') === '1') {
                    return;
                }

                event.preventDefault();

                sweetAlertReady.then(function (SwalInstance) {
                    var copy = getConfirmationCopy($form);

                    if (!SwalInstance) {
                        if (window.confirm(copy.text)) {
                            submitConfirmed($form);
                        }
                        return;
                    }

                    return SwalInstance.fire({
                        icon: 'question',
                        title: copy.title,
                        text: copy.text,
                        showCancelButton: true,
                        confirmButtonText: copy.confirmText,
                        cancelButtonText: 'Batal',
                        confirmButtonColor: copy.confirmColor,
                        cancelButtonColor: '#6c757d',
                        reverseButtons: true,
                        focusCancel: true,
                        allowOutsideClick: false
                    }).then(function (result) {
                        if (result.isConfirmed) {
                            submitConfirmed($form);
                        }
                    });
                });
            });
        });
    }

    function initServerNotice() {
        var $notice = $('.alert.alert-success, .alert.alert-danger').filter(function () {
            return $.trim($(this).text()) !== '';
        }).first();

        if (!$notice.length) {
            return;
        }

        var noticeText = $.trim($notice.text());
        var isSuccess = $notice.hasClass('alert-success');

        sweetAlertReady.then(function (SwalInstance) {
            if (!SwalInstance) {
                return;
            }

            $notice.remove();

            SwalInstance.fire({
                icon: isSuccess ? 'success' : 'error',
                title: isSuccess ? 'Berhasil' : 'Gagal',
                text: noticeText,
                confirmButtonText: 'OK',
                confirmButtonColor: isSuccess ? '#198754' : '#dc3545'
            });
        });
    }

    function initBackToTop() {
        var $button = $('<button/>', {
            type: 'button',
            id: 'backToTop',
            'aria-label': 'Kembali ke atas'
        }).html('<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>');

        $button.css({
            position: 'fixed',
            right: '20px',
            bottom: '20px',
            width: '44px',
            height: '44px',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            border: 0,
            borderRadius: 0,
            background: '#389f6a',
            color: '#ffffff',
            boxShadow: 'none',
            cursor: 'pointer',
            zIndex: 1040,
            padding: 0
        }).appendTo('body');

        function updateVisibility() {
            $button.toggle($(window).scrollTop() > 300);
        }

        $(window).on('scroll.backToTop', updateVisibility);

        $button.on('click', function () {
            $('html, body').stop(true).animate({ scrollTop: 0 }, 400);
        });

        updateVisibility();
    }

    function initDashboardEnhancements() {
        var $title = $('h1').filter(function () {
            return $.trim($(this).text()) === 'Reminder Jadwal Dokter';
        }).first();

        if (!$title.length) {
            return;
        }

        var $header = $title.closest('.row');
        var $filterForm = $header.find('form[method="get"]').first();
        var practiceDate = $.trim($header.find('p.text-secondary').first().text() || '');

        if ($filterForm.length) {
            var submitting = false;

            $filterForm.find('button[type="submit"]').remove();

            function submitFilter() {
                if (submitting) {
                    return;
                }

                submitting = true;
                setTimeout(function () {
                    $filterForm.trigger('submit');
                }, 50);
            }

            $filterForm.find('#doctorFilter, #poliFilter, #scheduleDate').off('.autoFilter')
                .on('change.autoFilter select2:select.autoFilter select2:clear.autoFilter', submitFilter);
        }

        if (practiceDate !== '') {
            $('h3.h5.mb-1').each(function () {
                var $doctorName = $(this);
                var $identity = $doctorName.parent();
                var $card = $doctorName.closest('.card');

                if (!$identity.length || !$card.length || $identity.find('.doctor-practice-date').length) {
                    return;
                }

                var $practiceInfo = $('<div/>', {
                    class: 'doctor-practice-date small mt-1'
                }).html(
                    '<span class="text-secondary">Praktek:</span> <span class="fw-semibold">' +
                    $('<div>').text(practiceDate).html() +
                    '</span>'
                );

                var timeValues = [];
                $card.find('.list-group-item .fw-semibold.text-nowrap').each(function () {
                    var value = $.trim($(this).text()).replace(/\s+/g, ' ');
                    if (value && $.inArray(value, timeValues) === -1) {
                        timeValues.push(value);
                    }
                });

                if (timeValues.length) {
                    $practiceInfo.append(
                        '<br><span class="text-secondary">Jam:</span> <span class="fw-semibold">' +
                        $('<div>').text(timeValues.join(', ')).html() +
                        '</span>'
                    );
                }

                $identity.append($practiceInfo);
            });
        }

        var $scheduleHeading = $('h2').filter(function () {
            return $.trim($(this).text()) === 'Jadwal Dokter';
        }).first();

        if ($scheduleHeading.length && !$('#sendAllDoctors').length) {
            var $headingRow = $scheduleHeading.closest('.d-flex.justify-content-between');

            if ($headingRow.length) {
                var $bulkWrap = $('<div/>', {
                    class: 'form-check d-flex align-items-center gap-2 mb-0'
                });
                var $bulkCheckbox = $('<input/>', {
                    class: 'form-check-input mt-0',
                    type: 'checkbox',
                    id: 'sendAllDoctors'
                });
                var $bulkLabel = $('<label/>', {
                    class: 'form-check-label fw-semibold',
                    for: 'sendAllDoctors',
                    text: 'Kirim Semua Dokter'
                });

                $bulkWrap.append($bulkCheckbox, $bulkLabel);
                $headingRow.append($bulkWrap);

                function randomDelaySeconds() {
                    return Math.floor(Math.random() * 13) + 8;
                }

                function sleep(milliseconds) {
                    var deferred = $.Deferred();
                    setTimeout(deferred.resolve, milliseconds);
                    return deferred.promise();
                }

                function updateReminderStatus(reminderId, action) {
                    var url = new URL(window.location.href);
                    url.searchParams.set('action', action);
                    url.searchParams.set('id', reminderId);

                    return $.ajax({
                        url: url.toString(),
                        type: 'GET',
                        cache: false
                    });
                }

                $bulkCheckbox.on('change', function () {
                    var checkbox = this;

                    if (!checkbox.checked) {
                        return;
                    }

                    var $allButtons = $('.js-whatsapp');
                    var $sendButtons = $allButtons.filter(function () {
                        var $button = $(this);
                        var buttonText = $.trim($button.text());

                        return $button.data('phone') &&
                            $button.data('message') &&
                            $button.data('reminderId') &&
                            buttonText.indexOf('Kirim Ulang') === -1;
                    });

                    if (!$sendButtons.length) {
                        checkbox.checked = false;

                        return Swal.fire({
                            icon: 'info',
                            title: 'Tidak ada reminder',
                            text: 'Semua dokter yang tampil sudah dikirim atau data WhatsApp belum lengkap.',
                            confirmButtonText: 'OK',
                            confirmButtonColor: '#198754'
                        });
                    }

                    Swal.fire({
                        icon: 'question',
                        title: 'Kirim Semua Dokter?',
                        html: 'Sistem akan mengirim reminder ke <strong>' + $sendButtons.length + ' dokter</strong> satu per satu.<br><br>Jeda antar nomor dibuat acak <strong>8–20 detik</strong> untuk menghindari pengiriman terlalu cepat.',
                        showCancelButton: true,
                        confirmButtonText: 'Ya, Kirim Semua',
                        cancelButtonText: 'Batal',
                        confirmButtonColor: '#198754',
                        cancelButtonColor: '#6c757d',
                        reverseButtons: true,
                        focusCancel: true
                    }).then(function (confirmation) {
                        if (!confirmation.isConfirmed) {
                            checkbox.checked = false;
                            return;
                        }

                        var gatewayUrl = 'http://' + location.hostname + ':3210';
                        var successCount = 0;
                        var failedCount = 0;
                        var failures = [];

                        $bulkCheckbox.prop('disabled', true);
                        $allButtons.prop('disabled', true);

                        function processNext(index) {
                            if (index >= $sendButtons.length) {
                                var resultHtml = 'Berhasil dikirim: <strong>' + successCount + '</strong><br>Gagal: <strong>' + failedCount + '</strong>';

                                if (failures.length) {
                                    resultHtml += '<br><br>Gagal dikirim ke:<br>' + failures.join('<br>');
                                }

                                return Swal.fire({
                                    icon: failedCount === 0 ? 'success' : 'warning',
                                    title: 'Pengiriman Selesai',
                                    html: resultHtml,
                                    confirmButtonText: 'OK',
                                    confirmButtonColor: '#198754'
                                }).then(function () {
                                    location.reload();
                                });
                            }

                            var $button = $sendButtons.eq(index);
                            var phone = $button.data('phone');
                            var message = $button.data('message');
                            var reminderId = $button.data('reminderId');
                            var doctorName = $button.data('doctorName') || 'Dokter';

                            Swal.fire({
                                title: 'Mengirim Reminder',
                                html: '<strong>' + (index + 1) + ' dari ' + $sendButtons.length + '</strong><br>' + doctorName + '<br>' + phone,
                                allowOutsideClick: false,
                                allowEscapeKey: false,
                                showConfirmButton: false,
                                didOpen: function () {
                                    Swal.showLoading();
                                }
                            });

                            $.ajax({
                                url: gatewayUrl + '/send',
                                type: 'POST',
                                contentType: 'application/json',
                                dataType: 'json',
                                data: JSON.stringify({
                                    phone: phone,
                                    message: message
                                })
                            }).done(function (result) {
                                if (!result.success) {
                                    throw new Error(result.message || 'Gagal mengirim WhatsApp.');
                                }

                                return updateReminderStatus(reminderId, 'sent');
                            }).done(function () {
                                successCount++;
                                $button.text('Kirim Ulang WhatsApp');
                                processNext(index + 1);
                            }).fail(function () {
                                failedCount++;
                                failures.push(doctorName);

                                updateReminderStatus(reminderId, 'failed')
                                    .always(function () {
                                        if (index < $sendButtons.length - 1) {
                                            var delaySeconds = randomDelaySeconds();

                                            Swal.fire({
                                                title: 'Menunggu Pengiriman Berikutnya',
                                                html: 'Berhasil: <strong>' + successCount + '</strong> &nbsp; Gagal: <strong>' + failedCount + '</strong><br><br>Jeda acak: <strong>' + delaySeconds + ' detik</strong>',
                                                allowOutsideClick: false,
                                                allowEscapeKey: false,
                                                showConfirmButton: false,
                                                didOpen: function () {
                                                    Swal.showLoading();
                                                }
                                            });

                                            sleep(delaySeconds * 1000).then(function () {
                                                processNext(index + 1);
                                            });
                                        } else {
                                            processNext(index + 1);
                                        }
                                    });
                            });
                        }

                        processNext(0);
                    }).always(function () {
                        $bulkCheckbox.prop('checked', false).prop('disabled', false);
                        $allButtons.prop('disabled', false);
                    });
                });
            }
        }

        var $previewLinks = $('a[href^="preview.php?id="]');

        if ($previewLinks.length && typeof bootstrap !== 'undefined') {
            if (!$('#previewReminderModal').length) {
                $('<div/>', {
                    class: 'modal fade',
                    id: 'previewReminderModal',
                    tabindex: -1,
                    'aria-hidden': 'true'
                }).html(
                    '<div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">' +
                    '<div class="modal-content">' +
                    '<div class="modal-header"><h5 class="modal-title">Preview Reminder WhatsApp</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button></div>' +
                    '<div class="modal-body p-0"><iframe id="previewReminderFrame" title="Preview Reminder WhatsApp" style="display:block;width:100%;height:72vh;border:0;background:#ffffff;"></iframe></div>' +
                    '<div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button></div>' +
                    '</div></div>'
                ).appendTo('body');
            }

            var $modal = $('#previewReminderModal');
            var $frame = $('#previewReminderFrame');

            $previewLinks.each(function () {
                var $link = $(this);
                $link.removeAttr('target')
                    .attr({
                        role: 'button',
                        'data-bs-toggle': 'modal',
                        'data-bs-target': '#previewReminderModal'
                    });
            });

            $modal.on('show.bs.modal', function (event) {
                var href = $(event.relatedTarget).attr('href') || '';
                $frame.attr('src', href);
            }).on('hidden.bs.modal', function () {
                $frame.attr('src', 'about:blank');
            });
        }
    }

    function initReportFilter() {
        var $form = $('#reportFilterForm');

        if (!$form.length) {
            return;
        }

        $form.find('#showReportButton').remove();
        var submitting = false;

        $form.find('#startDate, #endDate, #status').off('.reportAutoFilter')
            .on('change.reportAutoFilter', function () {
                if (submitting || !$.trim($('#startDate').val()) || !$.trim($('#endDate').val())) {
                    return;
                }

                submitting = true;
                setTimeout(function () {
                    $form.trigger('submit');
                }, 80);
            });
    }

    $(function () {
        initFormConfirmation();
        initServerNotice();
        initBackToTop();
        initDashboardEnhancements();
        initReportFilter();
    });
})(jQuery);
