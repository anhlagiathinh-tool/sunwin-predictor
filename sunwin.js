import fastify from "fastify";
import cors from "@fastify/cors";
import WebSocket from "ws";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// --- cấu hình ---
const port = 5000;
const ws_url = "wss://websocket.azhkthg1.net/websocket?token=";
const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJzc2NoaWNobWVtIiwiYm90IjowLCJpc01lcmNoYW50IjpmYWxzZSwidmVyaWZpZWRCYW5rQWNjb3VudCI6ZmFsc2UsInBsYXlFdmVudExvYmJ5IjpmYWxzZSwiY3VzdG9tZXJJZCI6MzI2OTA1OTg1LCJhZmZJZCI6InN1bndpbiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoic3VuLndpbiIsInRpbWVzdGFtcCI6MTc2NTcyMTc4ODY2OSwibG9ja0dhbWVzIjpbXSwiYW1vdW50IjowLCJsb2NrQ2hhdCI6ZmFsc2UsInBob25lVmVyaWZpZWQiOmZhbHNlLCJpcEFkZHJlc3MiOiIyNy43NC4yMzMuMjYiLCJtdXRlIjpmYWxzZSwiYXZhdGFyIjoiaHR0cHM6Ly9pbWFnZXMuc3dpbnNob3AubmV0L2ltYWdlcy9hdmF0YXIvYXZhdGFyXzE5LnBuZyIsInBsYXRmb3JtSWQiOjIsInVzZXJJZCI6IjlkMjE5YjRmLTI0MWEtNGZlNi05MjQyLTA0OTFmMWM0YTA1YyIsInJlZ1RpbWUiOjE3NjM3Mjc5MDc5NDAsInBob25lIjoiIiwiZGVwb3NpdCI6ZmFsc2UsInVzZXJuYW1lIjoiU0NfZ2lhdGhpbmgyMTMzIn0.XqfbpjtD4fpffVQ73v4cXkJ2gG-7jBIccSKKDi5Zm5A";

// --- biến toàn cục ---
let ket_qua = [];
let phien_hien_tai = null;
let ws = null;
let interval = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- cơ sở dữ liệu mẫu cầu thực tế ---
const mau_cau = {
    'bet_2': ['tt', 'xx'],
    'bet_3': ['ttt', 'xxx'],
    'bet_4': ['tttt', 'xxxx'],
    '1_1': ['tx', 'xt'],
    '2_2': ['ttxx', 'xxtt'],
    '3_3': ['tttxxx', 'xxxttt'],
    'zigzag': ['txt', 'xtx'],
    'zigzag_5': ['txtxt', 'xtxtx'],
    '1_2_1': ['txxxt', 'xtttx'],
    '2_1_2': ['ttxtt', 'xxtxx'],
    'dao_2': ['ttx', 'xxt'],
    'dao_3': ['tttx', 'xxxt'],
    'chu_ky_4': ['ttxx', 'xxtt'],
    'chu_ky_6': ['tttxxx', 'xxxttt'],
    'song_3': ['tttxxx', 'xxxttt'],
    'song_4': ['ttttxxxx', 'xxxxtttt'],
    'doi_xung_3': ['txt', 'xtx'],
    'doi_xung_5': ['ttxtt', 'xxtxx'],
    'lap_2': ['tt', 'xx'],
    'lap_3': ['ttt', 'xxx'],
    'xen_ke_3': ['txt', 'xtx'],
    'xen_ke_4': ['txtx', 'xtxt']
};

// --- hàm tiện ích ---
function phan_tich_du_lieu(du_lieu) {
    try {
        if (!du_lieu || !Array.isArray(du_lieu)) return [];
        
        return du_lieu
            .map(item => {
                if (typeof item === 'string') {
                    try {
                        item = JSON.parse(item);
                    } catch {
                        return null;
                    }
                }
                
                const session = Number(item.session) || 0;
                const dice = Array.isArray(item.dice) ? item.dice : [];
                const total = Number(item.total) || 0;
                const result = item.result || '';
                const tx = total >= 11 ? 't' : 'x';
                
                return { session, dice, total, result, tx };
            })
            .filter(item => item !== null && item.dice.length === 3)
            .sort((a, b) => a.session - b.session);
    } catch {
        return [];
    }
}

// --- thuật toán AI thực tế với độ tin cậy thật ---

// 1. AI phân tích mẫu cầu thực tế
function ai_phan_tich_mau_cau(lich_su) {
    if (!lich_su || lich_su.length < 25) return null;
    
    const day_tx = lich_su.map(h => h.tx);
    const gan_day = day_tx.slice(-12).join('');
    const toan_bo = day_tx.join('');
    
    let diem_t = 0;
    let diem_x = 0;
    let tong_trong_so = 0;
    let mau_phat_hien = null;
    
    for (const [ten_mau, cac_mau] of Object.entries(mau_cau)) {
        for (const mau of cac_mau) {
            const do_dai = mau.length;
            
            // chỉ xét mẫu có độ dài hợp lý
            if (do_dai < 2 || do_dai > 6) continue;
            
            // tìm mẫu trong lịch sử gần đây
            if (gan_day.includes(mau)) {
                const vi_tri = gan_day.lastIndexOf(mau);
                if (vi_tri + do_dai < gan_day.length) {
                    const ky_tu_tiep = gan_day.charAt(vi_tri + do_dai);
                    const trong_so = do_dai * 2; // mẫu càng dài càng quan trọng
                    
                    if (ky_tu_tiep === 't') {
                        diem_t += trong_so;
                        tong_trong_so += trong_so;
                        mau_phat_hien = ten_mau;
                    } else if (ky_tu_tiep === 'x') {
                        diem_x += trong_so;
                        tong_trong_so += trong_so;
                        mau_phat_hien = ten_mau;
                    }
                }
            }
        }
    }
    
    if (tong_trong_so === 0) return null;
    
    const ti_le_t = diem_t / tong_trong_so;
    const ti_le_x = diem_x / tong_trong_so;
    
    // chỉ trả về kết quả nếu có độ tin cậy cao
    if (ti_le_t > 0.7) return { du_doan: 't', do_tin_cay: ti_le_t, mau: mau_phat_hien };
    if (ti_le_x > 0.7) return { du_doan: 'x', do_tin_cay: ti_le_x, mau: mau_phat_hien };
    
    return null;
}

// 2. AI phân tích xu hướng thực tế
function ai_phan_tich_xu_huong(lich_su) {
    if (!lich_su || lich_su.length < 20) return null;
    
    const day_tx = lich_su.map(h => h.tx);
    const day_tong = lich_su.map(h => h.total);
    
    // phân tích 10 phiên gần nhất
    const gan_day_10 = day_tx.slice(-10);
    const t_gan_day = gan_day_10.filter(c => c === 't').length;
    const x_gan_day = gan_day_10.filter(c => c === 'x').length;
    
    // phân tích tổng điểm
    const trung_binh_tong = day_tong.reduce((a, b) => a + b, 0) / day_tong.length;
    const trung_binh_gan_day = day_tong.slice(-8).reduce((a, b) => a + b, 0) / 8;
    
    // tính điểm
    let diem_t = 0;
    let diem_x = 0;
    
    // xu hướng gần đây
    if (t_gan_day >= 7) diem_t += 2.0;
    if (x_gan_day >= 7) diem_x += 2.0;
    
    // phân tích điểm số
    if (trung_binh_gan_day > trung_binh_tong + 0.8) diem_t += 1.5;
    if (trung_binh_gan_day < trung_binh_tong - 0.8) diem_x += 1.5;
    
    // phân tích chuỗi hiện tại
    const ket_qua_cuoi = day_tx[day_tx.length - 1];
    let do_dai_chuoi = 0;
    for (let i = day_tx.length - 1; i >= 0; i--) {
        if (day_tx[i] === ket_qua_cuoi) {
            do_dai_chuoi++;
        } else {
            break;
        }
    }
    
    // logic bẻ cầu thông minh
    if (do_dai_chuoi >= 4) {
        if (ket_qua_cuoi === 't') diem_x += 2.5;
        else diem_t += 2.5;
    } else if (do_dai_chuoi >= 2 && do_dai_chuoi <= 3) {
        if (ket_qua_cuoi === 't') diem_t += 1.2;
        else diem_x += 1.2;
    }
    
    const tong_diem = diem_t + diem_x;
    if (tong_diem === 0) return null;
    
    const ti_le_t = diem_t / tong_diem;
    const ti_le_x = diem_x / tong_diem;
    
    if (ti_le_t > 0.65 && ti_le_t > ti_le_x) return { du_doan: 't', do_tin_cay: ti_le_t };
    if (ti_le_x > 0.65 && ti_le_x > ti_le_t) return { du_doan: 'x', do_tin_cay: ti_le_x };
    
    return null;
}

// 3. AI phân tích xác suất thực
function ai_phan_tich_xac_suat(lich_su) {
    if (!lich_su || lich_su.length < 30) return null;
    
    const day_tong = lich_su.map(h => h.total);
    
    // tính phân phối thực tế
    let dem_tai = 0;
    let dem_xiu = 0;
    
    day_tong.forEach(tong => {
        if (tong >= 11) dem_tai++;
        else dem_xiu++;
    });
    
    const tong_so = dem_tai + dem_xiu;
    if (tong_so < 15) return null;
    
    const xac_suat_tai = dem_tai / tong_so;
    const xac_suat_xiu = dem_xiu / tong_so;
    
    // tính xác suất gần đây
    const tong_gan_day = day_tong.slice(-15);
    let tai_gan_day = 0;
    let xiu_gan_day = 0;
    
    tong_gan_day.forEach(tong => {
        if (tong >= 11) tai_gan_day++;
        else xiu_gan_day++;
    });
    
    const tong_gan_day_so = tai_gan_day + xiu_gan_day;
    if (tong_gan_day_so < 5) return null;
    
    const xac_suat_tai_gan_day = tai_gan_day / tong_gan_day_so;
    const xac_suat_xiu_gan_day = xiu_gan_day / tong_gan_day_so;
    
    // kết hợp xác suất
    const xac_suat_tai_ket_hop = (xac_suat_tai * 0.4) + (xac_suat_tai_gan_day * 0.6);
    const xac_suat_xiu_ket_hop = (xac_suat_xiu * 0.4) + (xac_suat_xiu_gan_day * 0.6);
    
    // chỉ dự đoán khi có sự khác biệt đáng kể
    if (xac_suat_tai_ket_hop > 0.6 && xac_suat_tai_ket_hop > xac_suat_xiu_ket_hop) {
        return { du_doan: 't', do_tin_cay: xac_suat_tai_ket_hop };
    }
    if (xac_suat_xiu_ket_hop > 0.6 && xac_suat_xiu_ket_hop > xac_suat_tai_ket_hop) {
        return { du_doan: 'x', do_tin_cay: xac_suat_xiu_ket_hop };
    }
    
    return null;
}

// 4. AI theo cầu thông minh
function ai_theo_cau(lich_su) {
    if (!lich_su || lich_su.length < 15) return null;
    
    const day_tx = lich_su.map(h => h.tx);
    
    const ket_qua_cuoi = day_tx[day_tx.length - 1];
    let do_dai_cau = 0;
    
    // tính độ dài cầu hiện tại
    for (let i = day_tx.length - 1; i >= 0; i--) {
        if (day_tx[i] === ket_qua_cuoi) {
            do_dai_cau++;
        } else {
            break;
        }
    }
    
    // logic theo cầu
    if (do_dai_cau === 1) {
        // cầu mới bắt đầu, tiếp tục
        return { du_doan: ket_qua_cuoi, do_tin_cay: 0.65 };
    }
    
    if (do_dai_cau === 2) {
        // cầu ngắn, khả năng tiếp tục cao
        return { du_doan: ket_qua_cuoi, do_tin_cay: 0.7 };
    }
    
    if (do_dai_cau === 3) {
        // cầu trung bình, cần phân tích
        // tìm cầu tương tự trong lịch sử
        let so_cau_tuong_tu = 0;
        let tiep_tuc = 0;
        
        for (let i = 0; i <= day_tx.length - 4; i++) {
            if (day_tx[i] === ket_qua_cuoi && day_tx[i+1] === ket_qua_cuoi && day_tx[i+2] === ket_qua_cuoi) {
                so_cau_tuong_tu++;
                if (day_tx[i+3] === ket_qua_cuoi) {
                    tiep_tuc++;
                }
            }
        }
        
        if (so_cau_tuong_tu > 0) {
            const ti_le_tiep_tuc = tiep_tuc / so_cau_tuong_tu;
            if (ti_le_tiep_tuc > 0.5) {
                return { du_doan: ket_qua_cuoi, do_tin_cay: ti_le_tiep_tuc };
            }
        }
    }
    
    return null;
}

// 5. AI bẻ cầu thông minh
function ai_be_cau(lich_su) {
    if (!lich_su || lich_su.length < 20) return null;
    
    const day_tx = lich_su.map(h => h.tx);
    
    const ket_qua_cuoi = day_tx[day_tx.length - 1];
    let do_dai_cau = 0;
    
    // tính độ dài cầu hiện tại
    for (let i = day_tx.length - 1; i >= 0; i--) {
        if (day_tx[i] === ket_qua_cuoi) {
            do_dai_cau++;
        } else {
            break;
        }
    }
    
    // logic bẻ cầu
    if (do_dai_cau >= 4) {
        // cầu dài, khả năng bẻ cao
        const du_doan_be = ket_qua_cuoi === 't' ? 'x' : 't';
        
        // tính xác suất bẻ cầu từ lịch sử
        let so_cau_dai = 0;
        let so_lan_be = 0;
        
        for (let i = 0; i <= day_tx.length - do_dai_cau - 1; i++) {
            let giong = true;
            for (let j = 0; j < do_dai_cau; j++) {
                if (day_tx[i + j] !== ket_qua_cuoi) {
                    giong = false;
                    break;
                }
            }
            
            if (giong) {
                so_cau_dai++;
                if (day_tx[i + do_dai_cau] !== ket_qua_cuoi) {
                    so_lan_be++;
                }
            }
        }
        
        const do_tin_cay_be = so_cau_dai > 0 ? (so_lan_be / so_cau_dai) : 0.75;
        
        return { du_doan: du_doan_be, do_tin_cay: Math.max(0.7, do_tin_cay_be) };
    }
    
    return null;
}

// --- danh sách thuật toán AI ---
const tat_ca_thuat_toan = [
    { id: 'mau_cau', ten: 'Phân tích mẫu cầu', ham: ai_phan_tich_mau_cau },
    { id: 'xu_huong', ten: 'Phân tích xu hướng', ham: ai_phan_tich_xu_huong },
    { id: 'xac_suat', ten: 'Phân tích xác suất', ham: ai_phan_tich_xac_suat },
    { id: 'theo_cau', ten: 'AI theo cầu', ham: ai_theo_cau },
    { id: 'be_cau', ten: 'AI bẻ cầu', ham: ai_be_cau }
];

// --- hệ thống AI chính với độ tin cậy thực ---
class he_thong_ai_chinh {
    constructor() {
        this.lich_su = [];
        this.trong_so_thuat_toan = {};
        this.hieu_suat_thuat_toan = {};
        
        // thống kê hệ thống
        this.tong_du_doan = 0;
        this.du_doan_dung = 0;
        this.du_doan_cuoi = null;
        this.do_tin_cay_cuoi = 0.5;
        
        // khởi tạo thuật toán
        tat_ca_thuat_toan.forEach(thuat_toan => {
            this.trong_so_thuat_toan[thuat_toan.id] = 1.0;
            this.hieu_suat_thuat_toan[thuat_toan.id] = {
                dung: 0,
                tong: 0,
                ten: thuat_toan.ten
            };
        });
    }
    
    cap_nhat_hieu_suat(ket_qua_thuc) {
        if (!this.du_doan_cuoi) return;
        
        this.tong_du_doan++;
        if (this.du_doan_cuoi === ket_qua_thuc) {
            this.du_doan_dung++;
        }
        
        // cập nhật trọng số dựa trên hiệu suất gần đây
        const ti_le_thang = this.tong_du_doan > 0 ? this.du_doan_dung / this.tong_du_doan : 0.5;
        
        // điều chỉnh trọng số chung
        Object.keys(this.trong_so_thuat_toan).forEach(id => {
            const hieu_suat = this.hieu_suat_thuat_toan[id];
            if (hieu_suat.tong > 0) {
                const do_chinh_xac = hieu_suat.dung / hieu_suat.tong;
                this.trong_so_thuat_toan[id] = Math.max(0.5, Math.min(2.0, do_chinh_xac * 1.5));
            }
        });
    }
    
    tinh_do_tin_cay_thuc(du_doan_tu_cac_thuat_toan) {
        if (!du_doan_tu_cac_thuat_toan || du_doan_tu_cac_thuat_toan.length === 0) {
            return 0.5;
        }
        
        // nhóm dự đoán theo loại
        const nhom_t = [];
        const nhom_x = [];
        
        du_doan_tu_cac_thuat_toan.forEach(d => {
            if (d.du_doan === 't') {
                nhom_t.push(d.do_tin_cay);
            } else {
                nhom_x.push(d.do_tin_cay);
            }
        });
        
        // tính trung bình độ tin cậy cho mỗi nhóm
        const trung_binh_t = nhom_t.length > 0 ? nhom_t.reduce((a, b) => a + b, 0) / nhom_t.length : 0;
        const trung_binh_x = nhom_x.length > 0 ? nhom_x.reduce((a, b) => a + b, 0) / nhom_x.length : 0;
        
        // tính độ đồng thuận
        const so_thuat_toan = du_doan_tu_cac_thuat_toan.length;
        const do_dong_thuan_t = nhom_t.length / so_thuat_toan;
        const do_dong_thuan_x = nhom_x.length / so_thuat_toan;
        
        // tính độ tin cậy tổng hợp
        let do_tin_cay_thuc = 0.5;
        
        if (nhom_t.length > nhom_x.length) {
            // phần lớn dự đoán tài
            do_tin_cay_thuc = (trung_binh_t * 0.6) + (do_dong_thuan_t * 0.4);
        } else if (nhom_x.length > nhom_t.length) {
            // phần lớn dự đoán xỉu
            do_tin_cay_thuc = (trung_binh_x * 0.6) + (do_dong_thuan_x * 0.4);
        } else {
            // bằng nhau
            do_tin_cay_thuc = Math.max(trung_binh_t, trung_binh_x) * 0.8;
        }
        
        // điều chỉnh dựa trên số lượng thuật toán
        const he_so_so_luong = Math.min(1.0, so_thuat_toan / 3);
        do_tin_cay_thuc = 0.5 + (do_tin_cay_thuc - 0.5) * he_so_so_luong;
        
        // giới hạn thực tế
        return Math.max(0.5, Math.min(0.95, do_tin_cay_thuc));
    }
    
    du_doan() {
        if (!this.lich_su || this.lich_su.length < 15) {
            return {
                du_doan: 'tài',
                do_tin_cay: 0.5,
                du_doan_thuc: 't',
                so_thuat_toan: 0,
                ten_thuat_toan: []
            };
        }
        
        const tat_ca_du_doan = [];
        const ten_thuat_toan_da_dung = [];
        
        tat_ca_thuat_toan.forEach(thuat_toan => {
            try {
                const ket_qua = thuat_toan.ham(this.lich_su);
                if (ket_qua && ket_qua.du_doan && ket_qua.do_tin_cay) {
                    tat_ca_du_doan.push({
                        id: thuat_toan.id,
                        du_doan: ket_qua.du_doan,
                        do_tin_cay: ket_qua.do_tin_cay,
                        ten: thuat_toan.ten
                    });
                    ten_thuat_toan_da_dung.push(thuat_toan.ten);
                }
            } catch {
                // bỏ qua lỗi
            }
        });
        
        if (tat_ca_du_doan.length === 0) {
            return {
                du_doan: 'tài',
                do_tin_cay: 0.5,
                du_doan_thuc: 't',
                so_thuat_toan: 0,
                ten_thuat_toan: []
            };
        }
        
        // đếm phiếu bầu
        let dem_t = 0;
        let dem_x = 0;
        let tong_do_tin_cay_t = 0;
        let tong_do_tin_cay_x = 0;
        
        tat_ca_du_doan.forEach(d => {
            if (d.du_doan === 't') {
                dem_t++;
                tong_do_tin_cay_t += d.do_tin_cay;
            } else {
                dem_x++;
                tong_do_tin_cay_x += d.do_tin_cay;
            }
        });
        
        // quyết định dự đoán cuối cùng
        let du_doan_cuoi_cung = 't';
        let do_tin_cay = 0.5;
        
        if (dem_t > dem_x) {
            du_doan_cuoi_cung = 't';
            do_tin_cay = dem_t > 0 ? tong_do_tin_cay_t / dem_t : 0.5;
        } else if (dem_x > dem_t) {
            du_doan_cuoi_cung = 'x';
            do_tin_cay = dem_x > 0 ? tong_do_tin_cay_x / dem_x : 0.5;
        } else {
            // bằng nhau, chọn độ tin cậy cao hơn
            const trung_binh_t = dem_t > 0 ? tong_do_tin_cay_t / dem_t : 0;
            const trung_binh_x = dem_x > 0 ? tong_do_tin_cay_x / dem_x : 0;
            
            if (trung_binh_t > trung_binh_x) {
                du_doan_cuoi_cung = 't';
                do_tin_cay = trung_binh_t;
            } else {
                du_doan_cuoi_cung = 'x';
                do_tin_cay = trung_binh_x;
            }
        }
        
        // điều chỉnh độ tin cậy dựa trên độ đồng thuận
        const do_dong_thuan = Math.max(dem_t, dem_x) / tat_ca_du_doan.length;
        do_tin_cay = (do_tin_cay * 0.7) + (do_dong_thuan * 0.3);
        
        // giới hạn độ tin cậy thực tế
        do_tin_cay = Math.max(0.5, Math.min(0.92, do_tin_cay));
        
        // làm tròn
        do_tin_cay = Math.round(do_tin_cay * 100) / 100;
        
        this.du_doan_cuoi = du_doan_cuoi_cung;
        this.do_tin_cay_cuoi = do_tin_cay;
        
        return {
            du_doan: du_doan_cuoi_cung === 't' ? 'tài' : 'xỉu',
            do_tin_cay: do_tin_cay,
            du_doan_thuc: du_doan_cuoi_cung,
            so_thuat_toan: tat_ca_du_doan.length,
            ten_thuat_toan: ten_thuat_toan_da_dung
        };
    }
    
    them_ket_qua_moi(ket_qua) {
        const ket_qua_da_phan_tich = {
            session: Number(ket_qua.session) || 0,
            dice: Array.isArray(ket_qua.dice) ? ket_qua.dice : [],
            total: Number(ket_qua.total) || 0,
            result: ket_qua.result || '',
            tx: (Number(ket_qua.total) || 0) >= 11 ? 't' : 'x'
        };
        
        // cập nhật thống kê
        this.cap_nhat_hieu_suat(ket_qua_da_phan_tich.tx);
        
        this.lich_su.push(ket_qua_da_phan_tich);
        
        // giới hạn lịch sử
        if (this.lich_su.length > 100) {
            this.lich_su = this.lich_su.slice(-80);
        }
        
        return ket_qua_da_phan_tich;
    }
    
    tai_lich_su_du_lieu(du_lieu_lich_su) {
        this.lich_su = phan_tich_du_lieu(du_lieu_lich_su);
    }
    
    phan_tich_mau_cau_hien_tai() {
        if (this.lich_su.length < 10) {
            return { mau_cau: 'đang phân tích', chuoi_gan_day: '' };
        }
        
        const day_tx = this.lich_su.map(h => h.tx);
        const chuoi_gan_day = day_tx.slice(-8).join('');
        
        let mau_pho_bien_nhat = 'không xác định';
        
        for (const [ten_mau, cac_mau] of Object.entries(mau_cau)) {
            for (const mau of cac_mau) {
                if (chuoi_gan_day.includes(mau)) {
                    mau_pho_bien_nhat = ten_mau;
                    break;
                }
            }
            if (mau_pho_bien_nhat !== 'không xác định') break;
        }
        
        return {
            mau_cau: mau_pho_bien_nhat,
            chuoi_gan_day: chuoi_gan_day
        };
    }
    
    lay_thong_ke_thuat_toan() {
        const thong_ke = {};
        tat_ca_thuat_toan.forEach(thuat_toan => {
            const hieu_suat = this.hieu_suat_thuat_toan[thuat_toan.id];
            if (hieu_suat.tong > 0) {
                thong_ke[thuat_toan.id] = {
                    ten: hieu_suat.ten,
                    do_chinh_xac: ((hieu_suat.dung / hieu_suat.tong) * 100).toFixed(1) + '%',
                    tong_du_doan: hieu_suat.tong
                };
            }
        });
        return thong_ke;
    }
    
    lay_thong_ke_he_thong() {
        const tong = this.tong_du_doan;
        const dung = this.du_doan_dung;
        const ti_le_thang = tong > 0 ? (dung / tong) * 100 : 0;
        
        return {
            tong_du_doan: tong,
            du_doan_dung: dung,
            du_doan_sai: tong - dung,
            ti_le_thang: ti_le_thang.toFixed(1) + '%',
            so_thuat_toan: tat_ca_thuat_toan.length,
            so_luong_lich_su: this.lich_su.length,
            do_tin_cay_hien_tai: (this.do_tin_cay_cuoi * 100).toFixed(1) + '%'
        };
    }
}

// --- khởi tạo hệ thống AI ---
const he_thong_ai = new he_thong_ai_chinh();

// --- thiết lập server API ---
const app = fastify({ 
    logger: false,
    requestTimeout: 30000,
    connectionTimeout: 30000
});

// đăng ký CORS
app.register(cors, {
    origin: "*",
    methods: ["GET"],
    credentials: true
});

// --- các endpoint API ---

// kiểm tra server
app.get("/", async () => {
    return {
        trang_thai: "hoạt động",
        ten: "Hệ thống AI Nggiathinh",
        phien_ban: "3.0 - Độ tin cậy thực",
        mo_ta: "Hệ thống AI phân tích và dự đoán tài xỉu với độ tin cậy thực tế",
        so_thuat_toan: tat_ca_thuat_toan.length,
        endpoint: {
            du_doan: "/api/taixiu/sunwin/thinhtool",
            lich_su: "/api/taixiu/history/thinhtool",
            thong_ke: "/api/taixiu/sunwin/stats"
        }
    };
});

// endpoint dự đoán chính
app.get("/api/taixiu/sunwin/thinhtool", async () => {
    try {
        const ket_qua_hop_le = ket_qua.filter(r => r.dice && r.dice.length === 3);
        const ket_qua_cuoi = ket_qua_hop_le.length > 0 ? ket_qua_hop_le[0] : null;
        const du_doan_hien_tai = he_thong_ai.du_doan();
        const phan_tich_mau = he_thong_ai.phan_tich_mau_cau_hien_tai();
        
        if (!ket_qua_cuoi) {
            return {
                id: "@thinhtool",
                phien_truoc: null,
                xuc_xac1: null,
                xuc_xac2: null,
                xuc_xac3: null,
                tong: null,
                ket_qua: "đang chờ dữ liệu",
                phien_hien_tai: null,
                du_doan: "đang tính toán",
                do_tin_cay: "50%",
                ghi_chu_ai: "Hệ thống đang khởi tạo"
            };
        }
        
        // tạo ghi chú AI chi tiết
        let ghi_chu = "Hệ thống đang phân tích";
        if (du_doan_hien_tai.so_thuat_toan > 0) {
            const mau_cau_text = phan_tich_mau.mau_cau !== 'không xác định' ? `Mẫu: ${phan_tich_mau.mau_cau}` : 'Chưa xác định mẫu';
            ghi_chu = `${mau_cau_text} | ${du_doan_hien_tai.so_thuat_toan} thuật toán`;
        }
        
        return {
            id: "@thinhtool",
            phien_truoc: ket_qua_cuoi.session,
            xuc_xac1: ket_qua_cuoi.dice[0] || 0,
            xuc_xac2: ket_qua_cuoi.dice[1] || 0,
            xuc_xac3: ket_qua_cuoi.dice[2] || 0,
            tong: ket_qua_cuoi.total,
            ket_qua: ket_qua_cuoi.result.toLowerCase(),
            phien_hien_tai: ket_qua_cuoi.session + 1,
            du_doan: du_doan_hien_tai.du_doan,
            do_tin_cay: (du_doan_hien_tai.do_tin_cay * 100).toFixed(1) + "%",
            ghi_chu_ai: ghi_chu
        };
    } catch {
        return {
            id: "@thinhtool",
            error: "Hệ thống đang xử lý"
        };
    }
});

// endpoint lịch sử
app.get("/api/taixiu/history/thinhtool", async () => {
    try {
        const ket_qua_hop_le = ket_qua.filter(r => r.dice && r.dice.length === 3);
        if (ket_qua_hop_le.length === 0) {
            return { thong_bao: "Chưa có dữ liệu lịch sử" };
        }
        
        const lich_su = ket_qua_hop_le.slice(0, 15).map(item => ({
            session: item.session,
            xuc_xac1: item.dice[0] || 0,
            xuc_xac2: item.dice[1] || 0,
            xuc_xac3: item.dice[2] || 0,
            tong: item.total,
            ket_qua: item.result.toLowerCase(),
            tx: item.total >= 11 ? 'tài' : 'xỉu'
        }));
        
        return lich_su;
    } catch {
        return { thong_bao: "Lỗi hệ thống" };
    }
});

// endpoint thống kê
app.get("/api/taixiu/sunwin/stats", async () => {
    try {
        const thong_ke_thuat_toan = he_thong_ai.lay_thong_ke_thuat_toan();
        const thong_ke_he_thong = he_thong_ai.lay_thong_ke_he_thong();
        const du_doan_hien_tai = he_thong_ai.du_doan();
        const phan_tich_mau = he_thong_ai.phan_tich_mau_cau_hien_tai();
        
        return {
            trang_thai: "hoạt động",
            id: "Hệ thống AI Nggiathinh",
            thong_ke_he_thong: thong_ke_he_thong,
            du_doan_hien_tai: du_doan_hien_tai.du_doan,
            do_tin_cay: (du_doan_hien_tai.do_tin_cay * 100).toFixed(1) + "%",
            so_thuat_toan_hoat_dong: du_doan_hien_tai.so_thuat_toan,
            mau_cau_hien_tai: phan_tich_mau.mau_cau,
            thong_ke_thuat_toan: thong_ke_thuat_toan
        };
    } catch {
        return { loi: "Lỗi hệ thống" };
    }
});

// --- xử lý WebSocket ---
function giai_ma_tin_nhi_phan(du_lieu) {
    try {
        const tin_nhan = typeof du_lieu === 'string' ? du_lieu : new TextDecoder().decode(du_lieu);
        if (tin_nhan.startsWith('[') || tin_nhan.startsWith('{')) {
            return JSON.parse(tin_nhan);
        }
        return null;
    } catch {
        return null;
    }
}

function gui_lenh_websocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            const lenh = [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }];
            ws.send(JSON.stringify(lenh));
        } catch {
            // bỏ qua lỗi
        }
    }
}

function ket_noi_websocket() {
    if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
    }
    
    clearInterval(interval);
    
    try {
        ws = new WebSocket(`${ws_url}${token}`);
    } catch {
        setTimeout(ket_noi_websocket, 5000);
        return;
    }
    
    ws.on('open', () => {
        const payload_xac_thuc = [1, "MiniGame", "SC_giathinh2133", "thinh211", {
            info: JSON.stringify({
                ipAddress: "27.74.233.26",
                wsToken: token,
                userId: "9d219b4f-241a-4fe6-9242-0491f1c4a05c",
                username: "SC_giathinh2133",
                timestamp: Date.now(),
            }),
            signature: "833D61975D51ABF163F8D0100F8535B79041609BA84D57EF38426080E7E9FF259766624557BF43CC1F4A8067241BE50820974227143EF8B2D03C9F78F700B8D973AD19220FBF8FDD74E215D5F6E96476FDD16CB0A2B25FD109FEE6EB4380D24AE5B9FECF9CABD8FBDD2155FA717351B56A74EA2D730E9A6EC377165247743039",
            pid: 5,
            subi: true,
        }];
        
        try {
            ws.send(JSON.stringify(payload_xac_thuc));
        } catch {
            // bỏ qua lỗi
        }
        
        interval = setInterval(gui_lenh_websocket, 5000);
    });
    
    ws.on('message', (du_lieu) => {
        try {
            const json_du_lieu = giai_ma_tin_nhi_phan(du_lieu);
            if (!json_du_lieu) return;
            
            if (json_du_lieu.session && Array.isArray(json_du_lieu.dice)) {
                const ban_ghi_ket_qua = {
                    session: json_du_lieu.session,
                    dice: json_du_lieu.dice,
                    total: json_du_lieu.total || 0,
                    result: json_du_lieu.result || ''
                };
                
                const ket_qua_da_phan_tich = he_thong_ai.them_ket_qua_moi(ban_ghi_ket_qua);
                
                if (!phien_hien_tai || ban_ghi_ket_qua.session > phien_hien_tai) {
                    phien_hien_tai = ban_ghi_ket_qua.session;
                    ket_qua.unshift(ban_ghi_ket_qua);
                    
                    if (ket_qua.length > 80) {
                        ket_qua = ket_qua.slice(0, 80);
                    }
                }
            }
            
            if (Array.isArray(json_du_lieu) && json_du_lieu[1] && json_du_lieu[1].htr) {
                const du_lieu_lich_su = json_du_lieu[1].htr.map(item => ({
                    session: item.sid || 0,
                    dice: [item.d1 || 0, item.d2 || 0, item.d3 || 0],
                    total: (item.d1 || 0) + (item.d2 || 0) + (item.d3 || 0),
                    result: ((item.d1 || 0) + (item.d2 || 0) + (item.d3 || 0)) >= 11 ? "Tài" : "Xỉu"
                })).sort((a, b) => a.session - b.session);
                
                he_thong_ai.tai_lich_su_du_lieu(du_lieu_lich_su);
                ket_qua = du_lieu_lich_su.slice(-40).sort((a, b) => b.session - a.session);
            }
        } catch {
            // bỏ qua lỗi
        }
    });
    
    ws.on('close', () => {
        clearInterval(interval);
        setTimeout(ket_noi_websocket, 3000);
    });
    
    ws.on('error', () => {
        ws.close();
    });
}

// --- khởi động server ---
async function khoi_dong_server() {
    try {
        await app.listen({
            port: port,
            host: "0.0.0.0"
        });
        
        console.log("🌐 Server Chạy Tại Port 5000");
        
        ket_noi_websocket();
        
    } catch {
        process.exit(1);
    }
}

// chạy toàn bộ hệ thống
khoi_dong_server().catch(() => {
    process.exit(1);
});