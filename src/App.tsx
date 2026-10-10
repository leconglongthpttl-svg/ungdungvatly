import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  query, 
  where,
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  User,
  handleFirestoreError,
  OperationType
} from './firebase';
import { generateQuiz, Question } from './services/gemini';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, 
  Trophy, 
  History, 
  LogOut, 
  LogIn, 
  Play, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  Settings, 
  User as UserIcon,
  Clock, 
  AlertCircle, 
  Upload, 
  FileText, 
  X, 
  Download,
  BookOpen,
  GraduationCap,
  Sparkles,
  Globe,
  Search,
  Check,
  CheckCheck,
  FileCheck,
  Volume2,
  VolumeX
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import * as pdfjsLib from 'pdfjs-dist';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { sound } from './utils/audio';

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// --- Types ---
type AppState = 'LOBBY' | 'SETUP' | 'LOADING' | 'QUIZ' | 'RESULT';

interface QuizConfig {
  subject: string;
  grade: string;
  topic: string;
  count: number;
  reference: string;
  fileContent?: string;
  fileName?: string;
}

interface QuizStats {
  correct: number;
  wrong: number;
  timedOut: number;
  timeSpent: number;
}

const SUBJECT_PRESETS = [
  { name: 'Toán học', icon: '📐' },
  { name: 'Vật lí', icon: '⚡' },
  { name: 'Hóa học', icon: '🧪' },
  { name: 'Sinh học', icon: '🧬' },
  { name: 'Tiếng Anh', icon: '🌐' },
  { name: 'Lịch sử', icon: '📜' },
  { name: 'Địa lí', icon: '🌍' },
  { name: 'Tin học', icon: '💻' },
  { name: 'Ngữ văn', icon: '📖' },
  { name: 'GDKT & Pháp luật', icon: '⚖️' },
  { name: 'Khoa học tự nhiên', icon: '🔬' },
  { name: 'Công nghệ', icon: '🛠️' }
];

const GRADE_PRESETS = [
  'Lớp 12',
  'Lớp 11',
  'Lớp 10',
  'Lớp 9',
  'Lớp 8',
  'Lớp 7',
  'Lớp 6',
  'Ôn thi THPT',
  'Đại học / Khác'
];

const TOPIC_RECOMMENDATIONS: Record<string, string[]> = {
  'Toán học': [
    'Khảo sát sự biến thiên và đồ thị hàm số',
    'Nguyên hàm, tích phân và ứng dụng',
    'Phương pháp tọa độ trong không gian Oxyz',
    'Xác suất có điều kiện và biến cố',
    'Hàm số lũy thừa, hàm số mũ và logarit',
    'Khối đa diện và thể tích hình không gian',
    'Dãy số, cấp số cộng và cấp số nhân'
  ],
  'Vật lí': [
    'Dao động điều hòa và các dạng con lắc',
    'Sóng cơ, giao thoa sóng và sóng âm',
    'Dòng điện xoay chiều RLC nối tiếp',
    'Sóng điện từ và thông tin liên lạc',
    'Giao thoa và tán sắc ánh sáng',
    'Hiện tượng quang điện và lượng tử ánh sáng',
    'Vật lí hạt nhân và phản ứng phóng xạ'
  ],
  'Hóa học': [
    'Este - Lipit và xà phòng hóa',
    'Cacbohiđrat (Glucozơ, Saccarozơ, Tinh bột)',
    'Amin, Amino axit và Peptit - Protein',
    'Polime và vật liệu tổng hợp',
    'Đại cương kim loại và pin điện hóa',
    'Kim loại kiềm, kiềm thổ và nhôm',
    'Sắt, crom, đồng và hợp chất'
  ],
  'Sinh học': [
    'Cơ chế di truyền và biến dị phân tử (ADN, ARN)',
    'Đột biến gen và cấu trúc nhiễm sắc thể',
    'Quy luật di truyền Menđen và tương tác gen',
    'Di truyền học quần thể và di truyền người',
    'Học thuyết tiến hóa và chọn lọc tự nhiên',
    'Hệ sinh thái, chuỗi thức ăn và sinh quyển'
  ],
  'Tiếng Anh': [
    'Tenses & Verb Forms in Context',
    'Passive Voice & Impersonal Passive',
    'Conditional Sentences & Mixed Conditionals',
    'Relative Clauses & Reduced Relative Clauses',
    'Reported Speech & Subjunctive Structures',
    'Collocations, Idioms & Phrasal Verbs',
    'Reading Comprehension: Science & Technology'
  ],
  'Lịch sử': [
    'Cách mạng tháng Tám 1945 và nước VNDCCH',
    'Kháng chiến chống thực dân Pháp (1945 - 1954)',
    'Chiến thắng Điện Biên Phủ lịch sử 1954',
    'Kháng chiến chống Mỹ cứu nước (1954 - 1975)',
    'Chiến dịch Hồ Chí Minh 1975 thống nhất đất nước',
    'Trật tự thế giới sau CTTG II và xu thế toàn cầu hóa'
  ],
  'Địa lí': [
    'Vị trí địa lí và phạm vi lãnh thổ Việt Nam',
    'Địa hình, khí hậu và tài nguyên thiên nhiên',
    'Địa lí dân cư, lao động và đô thị hóa Việt Nam',
    'Địa lí các ngành kinh tế nông nghiệp - công nghiệp',
    'Phát triển kinh tế biển và bảo vệ chủ quyền biển đảo',
    'Các vùng kinh tế trọng điểm của Việt Nam'
  ],
  'Tin học': [
    'Lập trình cơ bản với ngôn ngữ Python',
    'Cấu trúc điều khiển: rẽ nhánh và lặp',
    'Cấu trúc dữ liệu mảng, danh sách và chuỗi ký tự',
    'Cơ sở dữ liệu quan hệ và câu lệnh SQL cơ bản',
    'Mạng máy tính, Internet và An toàn thông tin mạng',
    'Tổng quan về Trí tuệ nhân tạo (AI) và Học máy'
  ],
  'Ngữ văn': [
    'Văn học hiện đại Việt Nam giai đoạn 1945 - 1975',
    'Thơ ca kháng chiến chống Pháp và chống Mỹ',
    'Các biện pháp tu từ nghệ thuật và phong cách ngôn ngữ',
    'Đọc hiểu văn bản thông tin và nghị luận xã hội',
    'Kỹ năng viết bài văn nghị luận văn học'
  ],
  'GDKT & Pháp luật': [
    'Quy luật thị trường, cung cầu và giá cả',
    'Lạm phát, thất nghiệp và các chính sách kinh tế',
    'Hệ thống chính trị và Nhà nước pháp quyền Việt Nam',
    'Quyền bình đẳng của công dân trước pháp luật',
    'Quyền tự do cơ bản và nghĩa vụ công dân'
  ],
  'Khoa học tự nhiên': [
    'Cấu tạo nguyên tử, nguyên tố và bảng tuần hoàn',
    'Chuyển động, vận tốc và lực ma sát',
    'Năng lượng và các dạng biến đổi năng lượng',
    'Tế bào - Đơn vị cấu trúc của sự sống',
    'Hệ sinh thái và chuỗi - lưới thức ăn'
  ],
  'Công nghệ': [
    'Bản vẽ kỹ thuật và hình chiếu vuông góc',
    'Vật liệu cơ khí và phương pháp gia công cơ bản',
    'Mạch điện điều khiển và linh kiện điện tử',
    'Nông nghiệp công nghệ cao và bảo quản nông sản',
    'Tự động hóa và hệ thống tưới tiêu thông minh'
  ]
};

// --- Main Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appState, setAppState] = useState<AppState>('LOBBY');
  const [config, setConfig] = useState<QuizConfig>({ 
    subject: 'Toán học', 
    grade: 'Lớp 12', 
    topic: '', 
    count: 10, 
    reference: '', 
    fileContent: '', 
    fileName: '' 
  });
  const [generatingLang, setGeneratingLang] = useState<'vi' | 'en'>('vi');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]); // null means timed out or not answered
  const [stats, setStats] = useState<QuizStats>({ correct: 0, wrong: 0, timedOut: 0, timeSpent: 0 });
  const [timeLeft, setTimeLeft] = useState(30); // 30s per question
  const [totalTime, setTotalTime] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const totalTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user has entered all 4 required fields
  const isFormComplete = Boolean(
    config.subject.trim() &&
    config.grade.trim() &&
    config.topic.trim() &&
    config.count >= 5 &&
    config.count <= 50
  );

  // Update dynamic topic recommendations whenever subject changes
  useEffect(() => {
    const list = TOPIC_RECOMMENDATIONS[config.subject] || [
      'Kiến thức cốt lõi',
      'Đề cương ôn tập học kỳ',
      'Chuyên đề trọng tâm',
      'Bài tập vận dụng nâng cao'
    ];
    setTopicSuggestions(list);
  }, [config.subject]);

  // --- Utility Functions ---
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const shuffleOptions = (q: Question): Question => {
    const correctOptionText = q.options[q.correctAnswer];
    const shuffledOptions = shuffleArray(q.options);
    const newCorrectAnswer = shuffledOptions.indexOf(correctOptionText);
    return {
      ...q,
      options: shuffledOptions,
      correctAnswer: newCorrectAnswer
    };
  };

  // --- Auth & Data Listeners ---
  useEffect(() => {
    // Preload sounds
    const sounds = [
      'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
      'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
      'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'
    ];
    sounds.forEach(url => {
      const audio = new Audio();
      audio.src = url;
      audio.load();
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) {
        syncUser(u);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to history
    const historyQuery = query(
      collection(db, 'history'),
      where('userId', '==', user.uid),
      orderBy('completedAt', 'desc'),
      limit(10)
    );
    const unsubHistory = onSnapshot(historyQuery, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'history'));

    // Listen to leaderboard
    const lbQuery = query(
      collection(db, 'leaderboard'),
      orderBy('score', 'desc'),
      limit(10)
    );
    const unsubLB = onSnapshot(lbQuery, (snap) => {
      setLeaderboard(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'leaderboard'));

    return () => {
      unsubHistory();
      unsubLB();
    };
  }, [user]);

  const syncUser = async (u: User) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', u.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', u.uid), {
          uid: u.uid,
          displayName: u.displayName || 'Người dùng ẩn danh',
          photoURL: u.photoURL || '',
          totalScore: 0,
          quizzesCompleted: 0,
          lastActive: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('Error syncing user:', err);
    }
  };

  // --- Quiz Logic ---
  const startQuiz = async (lang: 'vi' | 'en' = 'vi') => {
    if (!config.subject.trim() || !config.grade.trim() || !config.topic.trim() || config.count < 5 || config.count > 50) {
      toast.error('Vui lòng nhập đủ: Môn, Lớp, Tên chủ đề và Số lượng câu hỏi (5 - 50 câu).');
      return;
    }

    setGeneratingLang(lang);
    setShowSuggestions(false);
    setAppState('LOADING');
    try {
      const generatedQuestions = await generateQuiz({
        subject: config.subject,
        grade: config.grade,
        topic: config.topic,
        count: config.count,
        reference: config.reference,
        fileContent: config.fileContent,
        language: lang
      });
      const shuffledQuestions = generatedQuestions.map(shuffleOptions);
      setQuestions(shuffledQuestions);
      setAnswers(new Array(shuffledQuestions.length).fill(null));
      setCurrentQuestionIndex(0);
      setStats({ correct: 0, wrong: 0, timedOut: 0, timeSpent: 0 });
      setTotalTime(0);
      setAppState('QUIZ');
      startQuestionTimer();
      startTotalTimer();
      toast.success(`Đã tạo thành công bộ đề gồm ${shuffledQuestions.length} câu hỏi!`);
    } catch (err: any) {
      console.error('Quiz creation error:', err);
      toast.error(err?.message || 'Không thể tạo bộ đề. Vui lòng kiểm tra kết nối và thử lại.');
      setAppState('SETUP');
    }
  };

  const downloadQuizDocx = async () => {
    if (questions.length === 0) return;

    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: `BỘ ĐỀ TRẮC NGHIỆM: ${config.topic.toUpperCase()}`,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Môn học: `, bold: true }),
                  new TextRun({ text: `${config.subject}   |   ` }),
                  new TextRun({ text: `Khối lớp: `, bold: true }),
                  new TextRun({ text: `${config.grade}   |   ` }),
                  new TextRun({ text: `Số lượng: `, bold: true }),
                  new TextRun({ text: `${questions.length} câu   |   ` }),
                  new TextRun({ text: `Ngôn ngữ: `, bold: true }),
                  new TextRun({ text: generatingLang === 'en' ? 'Tiếng Anh' : 'Tiếng Việt' }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 400 },
              }),
              ...questions.flatMap((q, index) => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Câu ${index + 1}: `,
                      bold: true,
                    }),
                    new TextRun(q.text.replace(/<[^>]*>/g, '')),
                  ],
                  spacing: { before: 200, after: 100 },
                }),
                ...q.options.map((opt, optIdx) => (
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `${String.fromCharCode(65 + optIdx)}. `,
                        bold: true,
                      }),
                      new TextRun(opt.replace(/<[^>]*>/g, '')),
                    ],
                    indent: { left: 720 },
                    spacing: { after: 50 },
                  })
                )),
              ]),
              new Paragraph({
                text: "--- BẢNG ĐÁP ÁN ĐÚNG ---",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 800, after: 200 },
              }),
              ...questions.map((q, index) => (
                new Paragraph({
                  text: `Câu ${index + 1}: ${String.fromCharCode(65 + q.correctAnswer)}`,
                })
              )),
              ...(questions.some(q => q.explanation) ? [
                new Paragraph({
                  text: "--- HƯỚNG DẪN GIẢI CHI TIẾT ---",
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 400, after: 200 },
                }),
                ...questions.map((q, index) => (
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Câu ${index + 1}: `, bold: true }),
                      new TextRun(q.explanation?.replace(/<[^>]*>/g, '') || "Đáp án đúng theo chuẩn kiến thức."),
                    ],
                    spacing: { after: 100 },
                  })
                )),
              ] : []),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const safeSubject = config.subject.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_');
      const safeGrade = config.grade.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_');
      const safeTopic = config.topic.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_');
      saveAs(blob, `BoDe_${safeSubject}_${safeGrade}_${safeTopic}.docx`);
      toast.success('Đã xuất file Word (.docx) thành công!');
    } catch (err) {
      console.error('Error generating docx:', err);
      toast.error('Có lỗi khi tạo file Word.');
    }
  };

  const startQuestionTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(30);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleAnswer(null); // Time out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startTotalTimer = () => {
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    totalTimerRef.current = setInterval(() => {
      setTotalTime(prev => prev + 1);
    }, 1000);
  };

  const handleAnswer = (answerIndex: number | null) => {
    if (activeQuestion === null) return;
    
    // Stop timers while showing feedback
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOptionIdx(answerIndex);

    const isCorrect = answerIndex !== null && answerIndex === questions[activeQuestion].correctAnswer;
    
    // Play sound effects via reliable Web Audio API
    if (isCorrect) {
      sound.playCorrect();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
    } else {
      sound.playWrong();
    }

    setAnswers(prev => {
      const next = [...prev];
      next[activeQuestion] = answerIndex;
      return next;
    });

    setStats(prev => ({
      ...prev,
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      wrong: answerIndex !== null && !isCorrect ? prev.wrong + 1 : prev.wrong,
      timedOut: answerIndex === null ? prev.timedOut + 1 : prev.timedOut
    }));

    setFeedback({
      type: isCorrect ? 'success' : 'error',
      text: isCorrect ? 'ĐÚNG! +1 ĐIỂM' : 'CHƯA CHÍNH XÁC!'
    });

    // Close modal after delay and check for completion
    setTimeout(() => {
      setFeedback(null);
      setSelectedOptionIdx(null);
      setActiveQuestion(null);
      
      // Check if all questions are answered
      setAnswers(currentAnswers => {
        const allAnswered = currentAnswers.every(a => a !== null);
        if (allAnswered) {
          finishQuiz();
        }
        return currentAnswers;
      });
    }, 1500);
  };

  const finishQuiz = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    
    setAppState('RESULT');
    
    // Play triumphant victory music fanfare
    sound.playVictory();

    // Multi-angle celebratory fireworks confetti
    const end = Date.now() + 1800;
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#eab308'];

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: colors
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    if (user) {
      try {
        const finalCorrect = answers.reduce((acc, val, idx) => (val === questions[idx].correctAnswer ? acc + 1 : acc), 0);
        const finalWrong = answers.filter((a, i) => a !== null && a !== questions[i].correctAnswer).length;
        const finalTimedOut = answers.filter(a => a === null).length;

        const quizResult = {
          userId: user.uid,
          subject: config.subject,
          grade: config.grade,
          topic: config.topic,
          score: finalCorrect,
          totalQuestions: questions.length,
          correctAnswers: finalCorrect,
          wrongAnswers: finalWrong,
          timedOutAnswers: finalTimedOut,
          timeSpent: totalTime,
          language: generatingLang,
          completedAt: serverTimestamp()
        };

        await addDoc(collection(db, 'history'), quizResult);
        
        // Update user stats
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          await setDoc(userRef, {
            ...data,
            totalScore: (data.totalScore || 0) + finalCorrect,
            quizzesCompleted: (data.quizzesCompleted || 0) + 1,
            lastActive: serverTimestamp()
          }, { merge: true });
        }

        // Update leaderboard
        await addDoc(collection(db, 'leaderboard'), {
          userId: user.uid,
          displayName: user.displayName || 'Ẩn danh',
          photoURL: user.photoURL || '',
          score: finalCorrect,
          topic: `[${config.subject} - ${config.grade}] ${config.topic}`,
          subject: config.subject,
          grade: config.grade,
          updatedAt: serverTimestamp()
        });

      } catch (err) {
        console.error('Error saving result:', err);
      }
    }
  };

  const restartQuiz = () => {
    const shuffledQuestions = questions.map(shuffleOptions);
    setQuestions(shuffledQuestions);
    setAnswers(new Array(shuffledQuestions.length).fill(null));
    setCurrentQuestionIndex(0);
    setStats({ correct: 0, wrong: 0, timedOut: 0, timeSpent: 0 });
    setTotalTime(0);
    setAppState('QUIZ');
    startQuestionTimer();
    startTotalTimer();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let text = '';
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          fullText += strings.join(' ') + '\n';
        }
        text = fullText;
      } else {
        text = await file.text();
      }

      if (text.trim().length < 50) {
        toast.error('Tài liệu quá ngắn hoặc không thể trích xuất nội dung.');
        return;
      }

      setConfig(prev => ({ ...prev, fileContent: text, fileName: file.name }));
      toast.success(`Đã tải lên tài liệu: ${file.name}`);
    } catch (err) {
      console.error('File upload error:', err);
      toast.error('Lỗi khi đọc tài liệu. Vui lòng thử lại với file TXT hoặc MD.');
    } finally {
      setIsUploading(false);
    }
  };

  // --- UI Helpers ---
  const renderLobby = () => (
    <div className="flex flex-col items-center justify-center min-h-[65vh] text-center space-y-8 max-w-4xl mx-auto py-6">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="p-7 bg-primary/10 rounded-full border-2 border-primary/20 shadow-xl relative"
      >
        <Brain className="w-24 h-24 text-primary animate-pulse" />
        <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground p-2 rounded-full shadow-md">
          <Sparkles className="w-5 h-5 text-amber-300" />
        </div>
      </motion.div>
      <div className="space-y-5">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold font-serif border border-primary/20">
          <Sparkles className="w-4 h-4 text-amber-500" /> Trợ lý tạo bộ đề thi thông minh chuẩn Sư phạm
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight font-serif text-balance">
          AI Quiz Master
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-[760px] mx-auto font-serif leading-relaxed text-balance">
          Tạo bộ đề trắc nghiệm tức thì bằng cách nhập <strong>[Môn]</strong>, <strong>[Lớp]</strong>, <strong>[Tên chủ đề]</strong> và <strong>[Số lượng câu]</strong>. AI tự động tra cứu mạng theo chuẩn GDPT, ưu tiên tài liệu tải lên, tạo đề song ngữ Việt / Anh kèm <strong>hiệu ứng âm thanh Đúng/Sai</strong> và <strong>nhạc chiến thắng</strong> sôi động.
        </p>

        {/* Feature Highlights */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 max-w-2xl mx-auto">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-serif rounded-xl border bg-muted/80">
            📚 Nhập đủ [Môn - Lớp - Chủ đề - Số câu]
          </Badge>
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-serif rounded-xl border bg-muted/80">
            🔍 Tự động dò tài liệu & Ưu tiên file riêng
          </Badge>
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-serif rounded-xl border bg-muted/80">
            🇻🇳 🇬🇧 Tạo đề song ngữ Việt / Anh
          </Badge>
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-serif rounded-xl border bg-muted/80">
            🔊 Hiệu ứng Đúng/Sai & Nhạc chiến thắng
          </Badge>
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-serif rounded-xl border bg-muted/80">
            📄 Tải về bản Word (.docx) chuẩn chỉnh
          </Badge>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
        <Button 
          size="lg" 
          onClick={() => setAppState('SETUP')} 
          className="text-xl px-10 py-7 rounded-2xl font-serif shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-0.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wide flex items-center gap-3 border-2 border-primary/30"
        >
          Thiết kế bộ đề ngay <Play className="w-6 h-6 fill-current" />
        </Button>
        {!user && (
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => signInWithPopup(auth, googleProvider)} 
            className="text-base px-6 py-7 rounded-2xl font-serif border-2 hover:bg-muted/80"
          >
            <LogIn className="w-5 h-5 mr-2" /> Đăng nhập để lưu điểm
          </Button>
        )}
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="max-w-3xl mx-auto space-y-8 py-8">
      <Card className="border-2 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground p-8">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl flex items-center gap-3 font-serif">
                <Settings className="w-8 h-8" /> Thiết kế bộ đề trắc nghiệm
              </CardTitle>
              <CardDescription className="text-primary-foreground/90 text-lg font-serif mt-2">
                Nhập đủ 4 thông tin: <strong>[Môn]</strong>, <strong>[Lớp]</strong>, <strong>[Tên chủ đề]</strong>, <strong>[Số câu]</strong> để mở khóa tạo đề tự động.
              </CardDescription>
            </div>
            <Sparkles className="w-10 h-10 opacity-75 hidden sm:block" />
          </div>
        </CardHeader>
        
        <CardContent className="p-8 space-y-8">
          {/* Section 1: MÔN HỌC */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xl font-bold font-serif flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> 1. Chọn hoặc nhập [MÔN HỌC] <span className="text-destructive">*</span>
              </Label>
              {config.subject && (
                <Badge variant="secondary" className="font-serif bg-primary/10 text-primary">
                  Đã chọn: {config.subject}
                </Badge>
              )}
            </div>

            {/* Subject presets chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {SUBJECT_PRESETS.map((sub) => {
                const isSelected = config.subject === sub.name;
                return (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => setConfig({ ...config, subject: sub.name })}
                    className={`
                      px-3 py-2.5 rounded-xl border-2 text-sm font-medium font-serif flex items-center justify-center gap-1.5 transition-all
                      ${isSelected 
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm scale-[1.02]' 
                        : 'border-muted hover:border-primary/50 hover:bg-muted/50'}
                    `}
                  >
                    <span>{sub.icon}</span>
                    <span className="truncate">{sub.name}</span>
                  </button>
                );
              })}
            </div>

            <Input 
              placeholder="Hoặc nhập tên môn học khác (Ví dụ: Toán cao cấp, Triết học, Hóa phân tích...)" 
              value={config.subject}
              onChange={(e) => setConfig({ ...config, subject: e.target.value })}
              className="text-lg p-5 rounded-xl border-2 focus-visible:ring-primary font-serif"
            />
          </div>

          {/* Section 2: KHỐI LỚP */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xl font-bold font-serif flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" /> 2. Chọn hoặc nhập [LỚP / TRÌNH ĐỘ] <span className="text-destructive">*</span>
              </Label>
              {config.grade && (
                <Badge variant="secondary" className="font-serif bg-primary/10 text-primary">
                  Đã chọn: {config.grade}
                </Badge>
              )}
            </div>

            {/* Grade preset chips */}
            <div className="flex flex-wrap gap-2">
              {GRADE_PRESETS.map((g) => {
                const isSelected = config.grade === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setConfig({ ...config, grade: g })}
                    className={`
                      px-4 py-2 rounded-xl border-2 text-sm font-medium font-serif transition-all
                      ${isSelected 
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm' 
                        : 'border-muted hover:border-primary/50 hover:bg-muted/50'}
                    `}
                  >
                    {g}
                  </button>
                );
              })}
            </div>

            <Input 
              placeholder="Hoặc nhập khối lớp / đối tượng (Ví dụ: Lớp 10 Chuyên, Ôn thi Đại học, Sinh viên năm 1...)" 
              value={config.grade}
              onChange={(e) => setConfig({ ...config, grade: e.target.value })}
              className="text-lg p-5 rounded-xl border-2 focus-visible:ring-primary font-serif"
            />
          </div>

          {/* Section 3: TÊN CHỦ ĐỀ */}
          <div className="space-y-3 relative">
            <div className="flex items-center justify-between">
              <Label htmlFor="topic" className="text-xl font-bold font-serif flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> 3. Nhập [TÊN CHỦ ĐỀ / BÀI HỌC] <span className="text-destructive">*</span>
              </Label>
            </div>
            
            <Input 
              id="topic" 
              placeholder={`Ví dụ: ${config.subject === 'Vật lí' ? 'Dao động điều hòa, Dòng điện xoay chiều' : config.subject === 'Hóa học' ? 'Este - Lipit, Kim loại kiềm' : 'Khảo sát hàm số, Lịch sử Việt Nam...'}`}
              value={config.topic}
              onChange={(e) => setConfig({ ...config, topic: e.target.value })}
              className="text-lg p-6 rounded-xl border-2 focus-visible:ring-primary font-serif"
            />

            {/* Topic Recommendations based on Subject */}
            {topicSuggestions.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-muted-foreground font-serif flex items-center gap-1">
                  <Search className="w-3.5 h-3.5" /> Gợi ý chủ đề thường gặp cho môn <strong>{config.subject || 'này'}</strong>:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topicSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setConfig({ ...config, topic: sug })}
                      className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors border font-serif text-left"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: SỐ LƯỢNG CÂU HỎI */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="count" className="text-xl font-bold font-serif flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> 4. Chọn [SỐ LƯỢNG CÂU HỎI] (5 - 50 câu) <span className="text-destructive">*</span>
              </Label>
              <Badge variant="outline" className="font-serif">
                Hiện tại: {config.count} câu
              </Badge>
            </div>

            {/* Quick chips for counts */}
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 20, 25, 30, 40, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setConfig({ ...config, count: num })}
                  className={`
                    px-4 py-2 rounded-xl border-2 text-sm font-bold font-serif transition-all
                    ${config.count === num 
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm' 
                      : 'border-muted hover:border-primary/50 hover:bg-muted/50'}
                  `}
                >
                  {num} câu
                </button>
              ))}
            </div>

            <Input 
              id="count" 
              type="number" 
              min={5} 
              max={50}
              value={config.count}
              onChange={(e) => setConfig({ ...config, count: parseInt(e.target.value) || 0 })}
              className="text-lg p-5 rounded-xl border-2 focus-visible:ring-primary font-serif"
            />
            {(config.count < 5 || config.count > 50) && config.count !== 0 && (
              <p className="text-destructive text-sm flex items-center gap-1 font-serif">
                <AlertCircle className="w-4 h-4" /> Số lượng phải từ 5 đến 50 câu.
              </p>
            )}
          </div>

          {/* Section 5: NGUỒN TÀI LIỆU ƯU TIÊN (TÙY CHỌN) */}
          <div className="p-6 bg-muted/40 rounded-2xl border-2 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0 mt-0.5">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-base font-serif text-primary">
                  Cơ chế tự động dò tài liệu trên mạng & ưu tiên biên soạn
                </p>
                <p className="text-xs text-muted-foreground font-serif leading-relaxed mt-1">
                  AI sẽ tự động tra cứu, tổng hợp chuẩn kiến thức môn <strong>{config.subject || '...'}</strong> ({config.grade || '...'}) trên mạng theo chương trình GDPT mới nhất. Nếu bạn có tài liệu riêng, hãy cung cấp bên dưới để AI <strong>ƯU TIÊN TUYỆT ĐỐI</strong> biên soạn từ nguồn của bạn:
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref" className="text-sm font-bold font-serif">
                Link tài liệu tham khảo hoặc tóm tắt (Ưu tiên 2 - Không bắt buộc)
              </Label>
              <Input 
                id="ref" 
                placeholder="Dán link website, link bài viết hoặc tóm tắt kiến thức..." 
                value={config.reference}
                onChange={(e) => setConfig({ ...config, reference: e.target.value })}
                className="text-sm p-4 rounded-xl border-2 focus-visible:ring-primary bg-background font-serif"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold font-serif">
                Tải lên tài liệu PDF, TXT, MD (Ưu tiên 1 - Cao nhất - Không bắt buộc)
              </Label>
              {!config.fileName ? (
                <div className="relative group">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isUploading}
                  />
                  <div className={`
                    border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-all bg-background
                    ${isUploading ? 'bg-muted opacity-50' : 'group-hover:border-primary group-hover:bg-primary/5'}
                  `}>
                    <div className="p-3 bg-primary/10 rounded-full">
                      {isUploading ? (
                        <div className="w-6 h-6 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div className="text-center font-serif">
                      <p className="font-bold text-sm">Nhấn để tải file PDF, TXT hoặc MD</p>
                      <p className="text-xs text-muted-foreground">AI sẽ đọc trực tiếp nội dung để ra đề bám sát</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-primary/5 border-2 border-primary rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold truncate max-w-[220px] sm:max-w-md text-sm font-serif">{config.fileName}</p>
                      <p className="text-xs text-green-600 font-bold font-serif">✓ Đã nạp thành công (Được ưu tiên tuyệt đối)</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setConfig(prev => ({ ...prev, fileName: '', fileContent: '' }))}
                    className="rounded-full hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Section 6: CHECKLIST & TRIGGER NOTIFICATION */}
          <div className="pt-2">
            {!isFormComplete ? (
              <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 space-y-2">
                <p className="font-bold text-amber-800 dark:text-amber-300 font-serif flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" /> Vui lòng nhập đủ 4 thông tin sau để mở khóa tạo bộ đề:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-serif pt-1">
                  <div className={`flex items-center gap-2 ${config.subject.trim() ? 'text-green-600 font-bold' : 'text-muted-foreground'}`}>
                    {config.subject.trim() ? <Check className="w-4 h-4 text-green-600" /> : <div className="w-2 h-2 rounded-full bg-amber-400 ml-1 mr-1" />}
                    [Môn]: {config.subject.trim() ? config.subject : 'Chưa nhập/chọn'}
                  </div>
                  <div className={`flex items-center gap-2 ${config.grade.trim() ? 'text-green-600 font-bold' : 'text-muted-foreground'}`}>
                    {config.grade.trim() ? <Check className="w-4 h-4 text-green-600" /> : <div className="w-2 h-2 rounded-full bg-amber-400 ml-1 mr-1" />}
                    [Lớp]: {config.grade.trim() ? config.grade : 'Chưa nhập/chọn'}
                  </div>
                  <div className={`flex items-center gap-2 ${config.topic.trim() ? 'text-green-600 font-bold' : 'text-muted-foreground'}`}>
                    {config.topic.trim() ? <Check className="w-4 h-4 text-green-600" /> : <div className="w-2 h-2 rounded-full bg-amber-400 ml-1 mr-1" />}
                    [Chủ đề]: {config.topic.trim() ? config.topic : 'Chưa nhập'}
                  </div>
                  <div className={`flex items-center gap-2 ${config.count >= 5 && config.count <= 50 ? 'text-green-600 font-bold' : 'text-muted-foreground'}`}>
                    {config.count >= 5 && config.count <= 50 ? <Check className="w-4 h-4 text-green-600" /> : <div className="w-2 h-2 rounded-full bg-amber-400 ml-1 mr-1" />}
                    [Số lượng câu]: {config.count >= 5 && config.count <= 50 ? `${config.count} câu` : 'Cần từ 5 đến 50 câu'}
                  </div>
                </div>
              </div>
            ) : (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-5 rounded-2xl bg-green-500/10 border-2 border-green-500/30 text-green-800 dark:text-green-300 space-y-1 font-serif"
              >
                <div className="flex items-center gap-2 font-bold text-base">
                  <CheckCheck className="w-5 h-5 text-green-600" /> 
                  Đã nhập đủ thông tin! AI đã sẵn sàng tự động dò tài liệu và biên soạn bộ đề.
                </div>
                <p className="text-xs opacity-90 pl-7">
                  Bộ đề: <strong>{config.subject}</strong> - <strong>{config.grade}</strong> | Chủ đề: <strong>"{config.topic}"</strong> ({config.count} câu). Hãy chọn ngôn ngữ bạn muốn để bắt đầu ngay:
                </p>
              </motion.div>
            )}
          </div>
        </CardContent>

        <CardFooter className="p-8 bg-muted/50 flex flex-col sm:flex-row gap-4 justify-between items-center border-t-2">
          <Button variant="ghost" onClick={() => setAppState('LOBBY')} className="text-lg font-serif">
            Quay lại trang chủ
          </Button>

          {/* GENERATION BUTTONS */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {isFormComplete ? (
              <>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => startQuiz('en')} 
                  className="text-lg px-6 py-6 rounded-2xl font-serif border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 shadow-md hover:shadow-lg transition-all"
                >
                  🇬🇧 Tạo đề bằng Tiếng Anh
                </Button>
                <Button 
                  size="lg" 
                  onClick={() => startQuiz('vi')} 
                  className="text-lg px-8 py-6 rounded-2xl font-serif shadow-lg hover:shadow-xl transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  🇻🇳 Tạo đề bằng Tiếng Việt
                </Button>
              </>
            ) : (
              <Button 
                size="lg" 
                disabled 
                className="text-lg px-8 py-6 rounded-2xl font-serif opacity-60 cursor-not-allowed"
              >
                Nhập đủ 4 mục trên để hiện nút Tạo đề
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 max-w-xl mx-auto px-4 text-center">
      <div className="relative">
        <div className="w-36 h-36 border-8 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <Brain className="w-14 h-14 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="space-y-3">
        <Badge className="text-base px-4 py-1.5 rounded-xl font-serif bg-primary">
          {config.subject} • {config.grade}
        </Badge>
        <h2 className="text-3xl font-bold font-serif">Đang tự động rà soát & tạo bộ đề...</h2>
        <p className="text-muted-foreground text-lg font-serif text-balance">
          Chủ đề: <strong>"{config.topic}"</strong> ({config.count} câu hỏi - {generatingLang === 'en' ? 'Tiếng Anh' : 'Tiếng Việt'})
        </p>
      </div>

      {/* Progress steps animation */}
      <div className="w-full bg-card p-5 rounded-2xl border-2 shadow-sm text-left space-y-3 font-serif text-sm">
        <div className="flex items-center gap-2.5 text-primary font-bold">
          <div className="w-3 h-3 rounded-full bg-primary animate-ping" />
          <span>1. Tự động rà soát tài liệu trên mạng theo chuẩn chương trình {config.subject} {config.grade}...</span>
        </div>
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <Check className="w-4 h-4 text-green-500 shrink-0" />
          <span>2. {config.fileName ? `Đang ưu tiên khai thác file: ${config.fileName}` : 'Đối chiếu kiến thức SGK và ngân hàng câu hỏi chuẩn...'}</span>
        </div>
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <Check className="w-4 h-4 text-green-500 shrink-0" />
          <span>3. Đảm bảo công thức toán/lý/hóa chuẩn xác (chỉ số trên, chỉ số dưới) và giải thích chi tiết...</span>
        </div>
      </div>
    </div>
  );

  const renderQuiz = () => {
    const answeredCount = answers.filter(a => a !== null).length;
    const progress = (answeredCount / questions.length) * 100;

    return (
      <div className="max-w-4xl mx-auto py-8 space-y-8">
        {/* Header Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-card p-6 rounded-3xl border-2 shadow-lg">
          <div className="flex-1 w-full space-y-2">
            <div className="flex justify-between text-sm font-bold uppercase tracking-wider text-muted-foreground font-serif">
              <span>{config.subject} ({config.grade}) • Tiến độ: {answeredCount} / {questions.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-4 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const nextMuted = sound.toggleMute();
                setIsMuted(nextMuted);
                toast.info(nextMuted ? 'Đã tắt âm thanh hiệu ứng' : 'Đã bật âm thanh hiệu ứng');
              }}
              className="rounded-2xl h-11 w-11 border-2"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-destructive" /> : <Volume2 className="w-5 h-5 text-green-600" />}
            </Button>
            <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-2xl border-2 border-primary/20">
              <Clock className="w-6 h-6 text-primary" />
              <span className="text-2xl font-bold text-primary font-serif">
                {Math.floor(totalTime / 60)}:{String(totalTime % 60).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Question Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {questions.map((_, idx) => {
            const ans = answers[idx];
            const isAnswered = ans !== null;
            const isCorrect = isAnswered && ans === questions[idx].correctAnswer;

            return (
              <motion.button
                key={idx}
                whileHover={!isAnswered ? { scale: 1.05, y: -5 } : {}}
                whileTap={!isAnswered ? { scale: 0.95 } : {}}
                onClick={() => !isAnswered && setActiveQuestion(idx)}
                className={`
                  aspect-square flex flex-col items-center justify-center rounded-3xl border-4 text-2xl font-black transition-all shadow-md font-serif
                  ${!isAnswered 
                    ? 'bg-background border-primary text-primary hover:bg-primary hover:text-white' 
                    : isCorrect 
                      ? 'bg-green-500 border-green-600 text-white cursor-default' 
                      : 'bg-red-500 border-red-600 text-white cursor-default'}
                `}
              >
                <span className="text-sm opacity-60 mb-1">CÂU</span>
                {idx + 1}
                {isAnswered && (
                  <div className="mt-2">
                    {isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            variant="outline" 
            onClick={downloadQuizDocx} 
            className="rounded-xl border-2 flex items-center gap-2 font-serif text-base px-6 py-5 border-green-600 text-green-700 hover:bg-green-50"
          >
            <Download className="w-5 h-5" /> Tải về bộ đề (.docx)
          </Button>
          <Button variant="ghost" onClick={() => setAppState('SETUP')} className="text-destructive hover:bg-destructive/10 rounded-xl font-serif">
            Hủy bỏ bộ đề này
          </Button>
        </div>

        {/* Question Modal */}
        <AnimatePresence>
          {activeQuestion !== null && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-5xl"
              >
                <Card className="border-4 shadow-[0_0_50px_rgba(0,0,0,0.3)] rounded-[3rem] overflow-hidden bg-card">
                  <CardHeader className="p-10 bg-muted/30 border-b-4">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <Badge className="text-2xl px-6 py-2 rounded-2xl bg-primary font-serif">
                          Câu {activeQuestion + 1} / {questions.length}
                        </Badge>
                        <Badge variant="outline" className="text-base px-4 py-1.5 rounded-xl font-serif">
                          {config.subject} • {config.grade}
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => !feedback && setActiveQuestion(null)}
                        className="rounded-full w-12 h-12 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="w-8 h-8" />
                      </Button>
                    </div>
                    <CardTitle className="text-4xl md:text-5xl leading-tight font-bold text-balance font-serif text-center">
                      <div className="text-center">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                          {questions[activeQuestion].text}
                        </ReactMarkdown>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 sm:p-10 grid grid-cols-1 md:grid-cols-2 gap-5 relative">
                    {questions[activeQuestion].options.map((option, idx) => {
                      const isSelected = selectedOptionIdx === idx;
                      const isCorrect = idx === questions[activeQuestion].correctAnswer;
                      
                      let optionStyle = "border-4 hover:border-primary hover:bg-primary/5 hover:scale-[1.01]";
                      let badgeStyle = "bg-secondary text-primary";

                      if (selectedOptionIdx !== null) {
                        if (isSelected && isCorrect) {
                          optionStyle = "bg-green-600 text-white border-green-700 shadow-xl ring-4 ring-green-300 scale-[1.02]";
                          badgeStyle = "bg-white text-green-700 font-black";
                        } else if (isSelected && !isCorrect) {
                          optionStyle = "bg-red-600 text-white border-red-700 shadow-xl ring-4 ring-red-300 animate-pulse";
                          badgeStyle = "bg-white text-red-700 font-black";
                        } else if (!isSelected && isCorrect) {
                          optionStyle = "bg-green-100 dark:bg-green-950/60 text-green-900 dark:text-green-100 border-green-600 ring-2 ring-green-400 font-bold";
                          badgeStyle = "bg-green-600 text-white font-black";
                        } else {
                          optionStyle = "opacity-40 grayscale border-muted";
                        }
                      }

                      return (
                        <Button
                          key={idx}
                          variant="outline"
                          disabled={selectedOptionIdx !== null}
                          className={`
                            h-auto p-6 sm:p-8 text-xl sm:text-2xl justify-start text-left whitespace-normal rounded-[2rem] transition-all font-serif
                            ${optionStyle}
                          `}
                          onClick={() => handleAnswer(idx)}
                        >
                          <span className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl mr-4 sm:mr-6 font-black shrink-0 text-xl sm:text-2xl transition-colors ${badgeStyle}`}>
                            {selectedOptionIdx !== null && isSelected && isCorrect ? (
                              <Check className="w-7 h-7 stroke-[3]" />
                            ) : selectedOptionIdx !== null && isSelected && !isCorrect ? (
                              <X className="w-7 h-7 stroke-[3]" />
                            ) : selectedOptionIdx !== null && !isSelected && isCorrect ? (
                              <Check className="w-7 h-7 stroke-[3]" />
                            ) : (
                              String.fromCharCode(65 + idx)
                            )}
                          </span>
                          <div className="flex-1 text-left leading-relaxed">
                            <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                              {option}
                            </ReactMarkdown>
                          </div>
                        </Button>
                      );
                    })}

                    {/* Feedback Overlay with sound & visual effect */}
                    <AnimatePresence>
                      {feedback && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className={`
                            absolute inset-0 flex flex-col items-center justify-center rounded-[2.5rem] z-20 backdrop-blur-md p-6 text-center
                            ${feedback.type === 'success' ? 'bg-green-600/95 border-4 border-green-300' : 'bg-red-600/95 border-4 border-red-300'}
                            text-white shadow-2xl
                          `}
                        >
                          {feedback.type === 'success' ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -45 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 15 }}
                            >
                              <CheckCircle2 className="w-32 h-32 sm:w-36 sm:h-36 mb-4 drop-shadow-xl" />
                            </motion.div>
                          ) : (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: [1, 1.1, 1], rotate: [0, -8, 8, 0] }}
                              transition={{ duration: 0.35 }}
                            >
                              <XCircle className="w-32 h-32 sm:w-36 sm:h-36 mb-4 drop-shadow-xl" />
                            </motion.div>
                          )}
                          <span className="text-5xl sm:text-7xl font-black uppercase tracking-wider drop-shadow-md font-serif">
                            {feedback.text}
                          </span>
                          {activeQuestion !== null && questions[activeQuestion].explanation && (
                            <p className="mt-3 max-w-xl text-sm sm:text-base bg-black/30 px-5 py-2.5 rounded-2xl font-serif text-white/95">
                              💡 {questions[activeQuestion].explanation}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderResult = () => {
    const totalQuestions = questions.length;
    const scorePercentage = Math.round((stats.correct / totalQuestions) * 100);

    return (
      <div className="max-w-4xl mx-auto py-12 space-y-8">
        <Card className="border-4 shadow-2xl rounded-[3rem] overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground p-12 text-center">
            <Badge className="mx-auto mb-4 text-base px-4 py-1 rounded-xl bg-white/20 text-white font-serif border-none">
              {config.subject} • {config.grade}
            </Badge>
            <CardTitle className="text-5xl font-bold mb-2 font-serif">Hoàn thành!</CardTitle>
            <CardDescription className="text-primary-foreground/90 text-xl font-serif text-balance">
              Bạn đã hoàn thành bộ đề "{config.topic}" môn {config.subject} ({config.grade})
            </CardDescription>
          </CardHeader>
          <CardContent className="p-12 space-y-12">
            {/* Score Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="space-y-2 p-6 bg-muted rounded-3xl border-2">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-serif">Tổng số câu</p>
                <p className="text-4xl font-black font-serif">{totalQuestions}</p>
              </div>
              <div className="space-y-2 p-6 bg-green-50 text-green-700 rounded-3xl border-2 border-green-200">
                <p className="text-sm font-bold uppercase tracking-wider opacity-80 font-serif">Số câu đúng</p>
                <p className="text-4xl font-black font-serif">{stats.correct}</p>
              </div>
              <div className="space-y-2 p-6 bg-red-50 text-red-700 rounded-3xl border-2 border-red-200">
                <p className="text-sm font-bold uppercase tracking-wider opacity-80 font-serif">Số câu sai</p>
                <p className="text-4xl font-black font-serif">{stats.wrong}</p>
              </div>
              <div className="space-y-2 p-6 bg-primary/10 text-primary rounded-3xl border-2 border-primary/20">
                <p className="text-sm font-bold uppercase tracking-wider opacity-80 font-serif">Tỉ lệ chính xác</p>
                <p className="text-4xl font-black font-serif">{scorePercentage}%</p>
              </div>
            </div>

            {/* Review Toggle Button */}
            <div className="text-center pt-4">
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => setShowReview(!showReview)}
                className="rounded-2xl border-2 font-serif text-lg px-8 py-6 hover:bg-muted"
              >
                {showReview ? 'Ẩn chi tiết câu sai' : 'Xem chi tiết câu sai'}
              </Button>
            </div>

            {/* Incorrect/Timed-out Questions Review */}
            <AnimatePresence>
              {showReview && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-6 pt-6 border-t-2"
                >
                  <h3 className="text-2xl font-bold text-primary font-serif">Chi tiết các câu cần lưu ý</h3>
                  <div className="space-y-6">
                    {stats.correct === questions.length ? (
                      <div className="p-8 text-center bg-green-50 rounded-3xl border-2 border-green-200 text-green-800 font-serif">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-600" />
                        <p className="text-xl font-bold">Xuất sắc! Bạn không làm sai câu nào!</p>
                        <p className="text-muted-foreground mt-1">Bạn đã đạt điểm số tuyệt đối trong bộ đề này.</p>
                      </div>
                    ) : (
                      questions.map((q, idx) => {
                        const userAns = answers[idx];
                        const isCorrect = userAns === q.correctAnswer;
                        const isTimedOut = userAns === null;

                        // Only show incorrect or timed-out questions
                        if (isCorrect) return null;

                        return (
                          <div key={idx} className={`p-6 rounded-3xl border-2 space-y-4 ${isTimedOut ? 'bg-gray-50 border-gray-100' : 'bg-red-50/50 border-red-100'}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <Badge className={`rounded-lg px-3 py-1 font-serif ${isTimedOut ? 'bg-gray-500' : 'bg-red-500'}`}>
                                  Câu {idx + 1}
                                </Badge>
                                {isTimedOut ? (
                                  <span className="text-gray-600 font-bold flex items-center gap-1 font-serif"><Clock className="w-4 h-4" /> Hết giờ</span>
                                ) : (
                                  <span className="text-red-600 font-bold flex items-center gap-1 font-serif"><XCircle className="w-4 h-4" /> Chưa đúng</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-lg font-bold leading-relaxed font-serif text-center">
                              <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                                {q.text}
                              </ReactMarkdown>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {q.options.map((opt, optIdx) => {
                                const isUserChoice = userAns === optIdx;
                                const isCorrectAns = q.correctAnswer === optIdx;
                                
                                let className = "justify-start text-left h-auto p-4 rounded-xl border-2 transition-none cursor-default font-serif ";
                                
                                if (isCorrectAns) {
                                  className += "bg-green-100 border-green-500 text-green-900 font-bold";
                                } else if (isUserChoice) {
                                  className += "bg-red-100 border-red-500 text-red-900 font-bold";
                                } else {
                                  className += "opacity-60";
                                }

                                return (
                                  <div key={optIdx} className={className}>
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded mr-3 text-xs font-bold ${isCorrectAns ? 'bg-green-500 text-white' : isUserChoice ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    {opt}
                                  </div>
                                );
                              })}
                            </div>

                            {q.explanation && (
                              <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 font-serif text-left">
                                <p className="text-sm font-bold text-primary mb-1 flex items-center gap-2">
                                  <Brain className="w-4 h-4" /> Giải thích:
                                </p>
                                <p className="text-sm text-muted-foreground leading-relaxed italic">
                                  {q.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
          
          <CardFooter className="p-12 bg-muted/50 flex flex-wrap gap-4 justify-center">
            <Button size="lg" variant="outline" onClick={() => sound.playVictory()} className="text-lg px-7 py-6 rounded-2xl w-full sm:w-auto border-2 border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 font-serif">
              Phát lại nhạc chiến thắng <Volume2 className="ml-2 w-5 h-5 text-amber-600" />
            </Button>
            <Button size="lg" variant="outline" onClick={downloadQuizDocx} className="text-lg px-8 py-6 rounded-2xl w-full sm:w-auto border-2 border-green-600 text-green-700 hover:bg-green-50 font-serif">
              Tải bộ đề (.docx) <Download className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={restartQuiz} className="text-lg px-8 py-6 rounded-2xl w-full sm:w-auto border-2 border-primary text-primary hover:bg-primary/5 font-serif">
              Làm lại đề này <RotateCcw className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => { setAppState('SETUP'); setShowReview(false); }} className="text-lg px-8 py-6 rounded-2xl w-full sm:w-auto font-serif">
              Thiết kế bộ đề mới
            </Button>
            <Button size="lg" onClick={() => { setAppState('LOBBY'); setShowReview(false); }} className="text-lg px-8 py-6 rounded-2xl w-full sm:w-auto font-serif">
              Về trang chủ
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary selection:text-primary-foreground">
      <Toaster position="top-center" richColors />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState('LOBBY')}>
            <div className="bg-primary p-1.5 rounded-lg">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight font-serif">AI Quiz Master</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextMuted = sound.toggleMute();
                setIsMuted(nextMuted);
                toast.info(nextMuted ? 'Đã tắt âm thanh hiệu ứng' : 'Đã bật âm thanh hiệu ứng');
              }}
              className="rounded-xl font-serif text-sm px-3 flex items-center gap-1.5 border-2"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-destructive" />
                  <span className="hidden sm:inline">Âm thanh: Tắt</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-green-600" />
                  <span className="hidden sm:inline">Âm thanh: Bật</span>
                </>
              )}
            </Button>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-bold font-serif">{user.displayName}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => signOut(auth)} className="rounded-full">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <Button onClick={() => signInWithPopup(auth, googleProvider)} className="rounded-full font-serif">
                Đăng nhập
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={appState}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {appState === 'LOBBY' && (
              <div className="space-y-12">
                {renderLobby()}
                
                {user && (
                  <Tabs defaultValue="leaderboard" className="max-w-4xl mx-auto">
                    <TabsList className="grid w-full grid-cols-2 h-14 p-1 rounded-2xl bg-muted">
                      <TabsTrigger value="leaderboard" className="text-lg rounded-xl data-[state=active]:shadow-lg font-serif">
                        <Trophy className="w-5 h-5 mr-2" /> Bảng xếp hạng
                      </TabsTrigger>
                      <TabsTrigger value="history" className="text-lg rounded-xl data-[state=active]:shadow-lg font-serif">
                        <History className="w-5 h-5 mr-2" /> Lịch sử làm bài
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="leaderboard" className="mt-6">
                      <Card className="border-2 rounded-3xl overflow-hidden shadow-lg">
                        <CardHeader className="bg-muted/50 border-b-2">
                          <CardTitle className="text-xl font-serif">Top 10 Cao thủ</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <ScrollArea className="h-[400px]">
                            {leaderboard.length > 0 ? (
                              <div className="divide-y-2">
                                {leaderboard.map((entry, idx) => (
                                  <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg
                                        ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground'}`}>
                                        {idx + 1}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {entry.photoURL ? (
                                          <img src={entry.photoURL} alt="" className="w-10 h-10 rounded-full border-2 border-primary/20" referrerPolicy="no-referrer" />
                                        ) : (
                                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <UserIcon className="w-6 h-6 text-primary" />
                                          </div>
                                        )}
                                        <div>
                                          <p className="font-bold font-serif">{entry.displayName}</p>
                                          <p className="text-xs text-muted-foreground">{entry.topic}</p>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xl font-black text-primary">{entry.score}đ</p>
                                      <p className="text-[10px] text-muted-foreground">{entry.updatedAt?.toDate ? format(entry.updatedAt.toDate(), 'dd/MM HH:mm') : ''}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground font-serif">
                                <Trophy className="w-12 h-12 mb-2 opacity-20" />
                                <p>Chưa có dữ liệu xếp hạng.</p>
                              </div>
                            )}
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="history" className="mt-6">
                      <Card className="border-2 rounded-3xl overflow-hidden shadow-lg">
                        <CardHeader className="bg-muted/50 border-b-2">
                          <CardTitle className="text-xl font-serif">10 lần làm bài gần nhất</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <ScrollArea className="h-[400px]">
                            {history.length > 0 ? (
                              <div className="divide-y-2">
                                {history.map((entry) => (
                                  <div key={entry.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        {entry.subject && (
                                          <Badge variant="outline" className="text-xs font-serif">
                                            {entry.subject} {entry.grade ? `(${entry.grade})` : ''}
                                          </Badge>
                                        )}
                                        <p className="font-bold text-lg font-serif">{entry.topic}</p>
                                      </div>
                                      <div className="flex gap-2">
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-serif">
                                          {entry.correctAnswers} đúng
                                        </Badge>
                                        <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 border-none font-serif">
                                          {entry.wrongAnswers} sai
                                        </Badge>
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-serif">
                                          {Math.floor(entry.timeSpent / 60)}p {entry.timeSpent % 60}s
                                        </Badge>
                                        {entry.language && (
                                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none font-serif">
                                            {entry.language === 'en' ? 'English' : 'Tiếng Việt'}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-2xl font-black text-primary">{entry.score} / {entry.totalQuestions}</p>
                                      <p className="text-xs text-muted-foreground">{entry.completedAt?.toDate ? format(entry.completedAt.toDate(), 'dd/MM/yyyy HH:mm') : ''}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground font-serif">
                                <History className="w-12 h-12 mb-2 opacity-20" />
                                <p>Bạn chưa thực hiện bộ đề nào.</p>
                              </div>
                            )}
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
            {appState === 'SETUP' && renderSetup()}
            {appState === 'LOADING' && renderLoading()}
            {appState === 'QUIZ' && renderQuiz()}
            {appState === 'RESULT' && renderResult()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t bg-muted/30">
        <div className="container mx-auto px-4 text-center text-muted-foreground font-serif space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:text-base font-semibold text-foreground/90">
            <span className="text-muted-foreground">Tác giả:</span>
            <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-primary/10 text-primary border border-primary/25 font-bold shadow-xs">
              Ths: Lê Công Long - QT
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            © 2026 AI Quiz Master. Tích hợp AI Gemini & Firebase • Soạn thảo đề thi thông minh chuẩn giáo dục.
          </p>
        </div>
      </footer>
    </div>
  );
}
