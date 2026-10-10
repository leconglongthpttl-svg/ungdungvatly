import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number; // index of options (0-3)
  explanation?: string;
}

export interface GenerateQuizParams {
  subject: string;
  grade: string;
  topic: string;
  count: number;
  reference?: string;
  fileContent?: string;
  language?: 'vi' | 'en';
}

export async function generateQuiz(params: GenerateQuizParams): Promise<Question[]> {
  const {
    subject,
    grade,
    topic,
    count,
    reference,
    fileContent,
    language = 'vi'
  } = params;

  const langText = language === 'en' ? 'English' : 'Tiếng Việt';
  
  const prompt = `Bạn là một chuyên gia khảo thí và giáo viên giàu kinh nghiệm. Hãy biên soạn chính xác ${count} câu hỏi trắc nghiệm khách quan với các thông tin sau:
- MÔN HỌC: ${subject || 'Không xác định'}
- KHỐI LỚP / TRÌNH ĐỘ: ${grade || 'Phổ thông'}
- TÊN CHỦ ĐỀ: ${topic}
- SỐ LƯỢNG CÂU HỎI: Đúng ${count} câu
- NGÔN NGỮ ĐẦU RA: ${langText}. Toàn bộ nội dung câu hỏi, 4 phương án lựa chọn và giải thích PHẢI bằng ${langText}.

QUY TẮC RÀ SOÁT VÀ ƯU TIÊN NGUỒN TÀI LIỆU:
1. ƯU TIÊN 1 (Tuyệt đối): Nếu có "Nội dung tài liệu đính kèm" dưới đây, hãy ƯU TIÊN TUYỆT ĐỐI việc khai thác nội dung, kiến thức cốt lõi và câu hỏi từ tài liệu này.
2. ƯU TIÊN 2: Nếu có "Tài liệu tham khảo (link/tóm tắt)" bên dưới, hãy tham chiếu và bám sát nguồn dữ liệu đó.
3. ƯU TIÊN 3 (Tự động dò tài liệu trên mạng & chuẩn kiến thức): Nếu không có file/link hoặc cần bổ sung đầy đủ các mức độ kiến thức, hãy tự động rà soát, tra cứu và đối chiếu các nguồn tài liệu sư phạm trên mạng, chuẩn chương trình giáo dục phổ thông mới của Bộ Giáo dục & Đào tạo Việt Nam dành cho môn "${subject}" khối "${grade}", bám sát các bộ SGK chuẩn (Kết nối tri thức, Chân trời sáng tạo, Cánh diều) và đề thi chuẩn.

${fileContent ? `--- NỘI DUNG TÀI LIỆU ĐÍNH KÈM (ƯU TIÊN 1) ---
${fileContent}
--- KẾT THÚC TÀI LIỆU ĐÍNH KÈM ---` : ""}

${reference ? `--- TÀI LIỆU THAM KHẢO (LINK/TÓM TẮT) (ƯU TIÊN 2) ---
${reference}
--- KẾT THÚC TÀI LIỆU THAM KHẢO ---` : ""}

YÊU CẦU ĐỘ CHÍNH XÁC VÀ BÁM SÁT CHỦ ĐỀ (RẤT QUAN TRỌNG):
- Độ chính xác tuyệt đối: Kiến thức khoa học, thuật ngữ chuyên môn, công thức, số liệu và sự kiện phải chính xác 100%, không bị sai lệch.
- Bám sát trọng tâm chủ đề "${topic}" của môn "${subject}" ${grade}, không ra đề lan man, không lặp lại câu hỏi.
- Phù hợp trình độ: Câu hỏi phân hóa hợp lý (Nhận biết, Thông hiểu, Vận dụng) đúng với lứa tuổi và chương trình học của học sinh ${grade}.
- ĐỐI VỚI CÔNG THỨC TOÁN / LÝ / HÓA: BẮT BUỘC dùng thẻ HTML <sup> cho chỉ số trên / số mũ (ví dụ: x<sup>2</sup>, 10<sup>-3</sup>) và <sub> cho chỉ số dưới (ví dụ: H<sub>2</sub>SO<sub>4</sub>, U<sub>R</sub>, log<sub>2</sub>x) để học sinh xem từ xa khi trình chiếu không bao giờ bị nhầm lẫn.
- Cấu trúc mỗi câu: Đúng 4 phương án lựa chọn (A, B, C, D). Chỉ có DUY NHẤT 1 phương án đúng. Các phương án nhiễu phải hợp lý, mang tính phân loại học sinh tốt, không lộ liễu hay vô lý.
- Giải thích (explanation): Giải thích ngắn gọn nhưng rõ ràng, chuẩn xác tại sao phương án đó đúng và phương pháp / lý thuyết giải bài.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Nội dung câu hỏi" },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Danh sách đúng 4 phương án trả lời"
              },
              correctAnswer: { 
                type: Type.INTEGER, 
                description: "Chỉ số của đáp án đúng trong mảng options (0, 1, 2 hoặc 3)" 
              },
              explanation: { type: Type.STRING, description: "Giải thích chi tiết, chính xác tại sao đáp án đó đúng" }
            },
            required: ["text", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("Không nhận được dữ liệu phản hồi từ AI.");
    }

    const questions: any[] = JSON.parse(response.text);
    
    if (!Array.isArray(questions)) {
      throw new Error("Dữ liệu trả về không phải là danh sách câu hỏi.");
    }
    
    const validatedQuestions: Question[] = questions.map((q, index) => {
      if (!q.text || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctAnswer !== 'number') {
        throw new Error(`Câu hỏi thứ ${index + 1} không đầy đủ định dạng.`);
      }
      return {
        id: `q-${Date.now()}-${index}`,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "Đáp án đúng theo chuẩn kiến thức bộ môn."
      };
    });

    if (validatedQuestions.length !== count) {
      console.warn(`Yêu cầu ${count} câu nhưng nhận được ${validatedQuestions.length} câu.`);
    }

    return validatedQuestions.slice(0, count);
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error);
    throw error;
  }
}
