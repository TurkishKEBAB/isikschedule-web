import type { Language } from '../context/LanguageContext';

export const LEGAL_LAST_UPDATED = '2026-06-28';

export const DATA_CONTROLLER = 'Yiğit Okur';

export const CONTACT_EMAILS = ['23SOFT1040@isik.edu.tr', 'yigitokur29@gmail.com'];

export type LegalSection = {
    heading: string;
    body: string[];
};

type LegalContent = Record<Language, LegalSection[]>;

export const privacyContent: LegalContent = {
    tr: [
        {
            heading: 'Veri sorumlusu ve kapsam',
            body: [
                'Bu KVKK aydınlatma metni ve gizlilik politikası, IşıkSchedule uygulamasını kullanan kişiler için hazırlanmıştır. IşıkSchedule, Işık Üniversitesi tarafından sunulan resmi bir hizmet değil, bağımsız bir öğrenci projesidir.',
                `Veri sorumlusu ${DATA_CONTROLLER}. İletişim için ${CONTACT_EMAILS.join(' veya ')} adreslerini kullanabilirsiniz.`,
            ],
        },
        {
            heading: 'İşlenen kişisel veriler',
            body: [
                'Uygulama; e-posta adresinizi, hashlenmiş parolanızı, oluşturduğunuz veya kaydettiğiniz ders programlarını, paylaşım linklerini ve arkadaşlık ilişkilerini işleyebilir.',
                'Parolanız açık metin olarak saklanmaz. Ders programı verileri, uygulamanın program oluşturma, kaydetme ve paylaşma özellikleri için tutulur.',
            ],
        },
        {
            heading: 'İşleme amacı ve hukuki sebep',
            body: [
                'Veriler; hesap oluşturma, kimlik doğrulama, ders programı oluşturma, programı saklama, paylaşma ve arkadaşlık özelliklerini çalıştırma amaçlarıyla işlenir.',
                'KVKK madde 5 kapsamında bu işleme; hizmetin sunulması için açık rızanıza ve kullanıcı ilişkisinin ifasına dayanır.',
            ],
        },
        {
            heading: 'Saklama süresi',
            body: [
                'Kişisel verileriniz hesabınız aktif olduğu sürece saklanır. Silme talebiniz üzerine ilgili veriler makul teknik süreçler içinde ve en geç 30 gün içinde imha edilir.',
                'Paylaşım linkleri, link aktif kaldığı sürece ilgili program verisine erişim sağlayabilir. Linki paylaştığınız kişilerin erişiminden siz sorumlusunuz.',
            ],
        },
        {
            heading: 'Üçüncü taraflar ve aktarım',
            body: [
                'Verileriniz pazarlama veya analitik amacıyla üçüncü taraflarla paylaşılmaz. Uygulama analytics veya çerez takibi kullanmaz.',
                'Veriler, yalnızca uygulamanın çalıştığı barındırma altyapısında teknik olarak işlenebilir. Yetkili kamu kurumlarından gelen hukuka uygun talepler saklıdır.',
            ],
        },
        {
            heading: 'Haklarınız',
            body: [
                'KVKK madde 11 kapsamında; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, eksik veya yanlış işlenmiş verilerin düzeltilmesini isteme, silme veya yok etme talep etme ve hukuka aykırı işlemeye itiraz etme haklarınız vardır.',
                `Bu hakları kullanmak için ${CONTACT_EMAILS.join(' veya ')} adreslerinden iletişime geçebilirsiniz.`,
            ],
        },
        {
            heading: 'Dil ve güncelleme',
            body: [
                'Bu metnin Türkçe sürümü esas kabul edilir. İngilizce metin kullanıcıların anlamasını kolaylaştırmak için hazırlanmış nezaket çevirisidir.',
                'Metin, uygulama geliştikçe güncellenebilir. Önemli değişikliklerde kullanıcılara uygulama üzerinden bilgilendirme yapılması hedeflenir.',
            ],
        },
    ],
    en: [
        {
            heading: 'Data controller and scope',
            body: [
                'This KVKK notice and privacy policy applies to people using IşıkSchedule. IşıkSchedule is an independent student project, not an official service provided by Işık University.',
                `${DATA_CONTROLLER} is the data controller. You can contact the controller at ${CONTACT_EMAILS.join(' or ')}.`,
            ],
        },
        {
            heading: 'Personal data processed',
            body: [
                'The app may process your email address, hashed password, generated or saved course schedules, share links, and friendship relationships.',
                'Your password is not stored in plain text. Schedule data is kept so the app can generate, save, and share course schedules.',
            ],
        },
        {
            heading: 'Purpose and legal basis',
            body: [
                'Data is processed to create accounts, authenticate users, generate schedules, save schedules, share schedules, and operate friendship features.',
                'Under KVKK Article 5, processing is based on your explicit consent where required and on providing the requested user service.',
            ],
        },
        {
            heading: 'Retention period',
            body: [
                'Personal data is kept while your account remains active. If you request deletion, relevant data is erased within reasonable technical processes and no later than 30 days.',
                'Share links may continue to provide access to the related schedule while they remain active. You are responsible for the people you share those links with.',
            ],
        },
        {
            heading: 'Third parties and transfers',
            body: [
                'Your data is not shared with third parties for marketing or analytics. The app does not use analytics or tracking cookies.',
                'Data may be technically processed only on the hosting infrastructure where the app runs. Lawful requests from authorized public authorities are reserved.',
            ],
        },
        {
            heading: 'Your rights',
            body: [
                'Under KVKK Article 11, you may ask whether your data is processed, request information, ask for correction of incomplete or inaccurate data, request deletion or destruction, and object to unlawful processing.',
                `To exercise these rights, contact ${CONTACT_EMAILS.join(' or ')}.`,
            ],
        },
        {
            heading: 'Language and updates',
            body: [
                'The Turkish version of this notice is the binding version. The English version is provided as a courtesy translation for easier understanding.',
                'This notice may be updated as the app evolves. For material changes, the goal is to inform users through the app.',
            ],
        },
    ],
};

export const termsContent: LegalContent = {
    tr: [
        {
            heading: 'Hizmetin niteliği',
            body: [
                'IşıkSchedule, öğrencilerin ders programı seçeneklerini oluşturmasına, saklamasına ve paylaşmasına yardım eden bağımsız bir öğrenci projesidir.',
                'Uygulama resmi akademik kayıt, ders alma veya üniversite karar sistemi değildir. Nihai ders seçimi ve akademik uygunluk kontrolü kullanıcının sorumluluğundadır.',
            ],
        },
        {
            heading: 'Hesap ve güvenlik',
            body: [
                'Hesap oluştururken Işık alan adına ait geçerli bir e-posta adresi kullanmanız gerekir. Hesap bilgilerinizin gizliliğinden siz sorumlusunuz.',
                'Sistemi kötüye kullanmak, başkasının hesabına erişmeye çalışmak veya paylaşım linklerini yetkisiz şekilde yaymak yasaktır.',
            ],
        },
        {
            heading: 'Program verisi ve doğruluk',
            body: [
                'Program önerileri, yüklenen veya aktif dönem olarak tanımlanan ders verilerine göre üretilir. Kaynak veride hata, eksiklik veya sonradan yapılan değişiklikler olabilir.',
                'Oluşturulan programları resmi üniversite sistemleri ve bölüm duyuruları ile karşılaştırarak doğrulamanız gerekir.',
            ],
        },
        {
            heading: 'Paylaşım linkleri',
            body: [
                'Paylaşım linkleri, linke sahip kişilerin ilgili programı görüntülemesini sağlar. Linki kimlerle paylaştığınızı kontrol etmek sizin sorumluluğunuzdadır.',
                'Paylaşılan programlar ders seçim tercihlerinizi ortaya çıkarabileceği için linkleri dikkatli kullanmanızı öneririz.',
            ],
        },
        {
            heading: 'Değişiklikler ve iletişim',
            body: [
                'Uygulama özellikleri ve bu şartlar zaman içinde güncellenebilir. Önemli değişikliklerde kullanıcıları bilgilendirmek hedeflenir.',
                `Sorularınız veya talepleriniz için ${CONTACT_EMAILS.join(' veya ')} adreslerinden iletişime geçebilirsiniz.`,
            ],
        },
    ],
    en: [
        {
            heading: 'Nature of the service',
            body: [
                'IşıkSchedule is an independent student project that helps students generate, save, and share course schedule options.',
                'The app is not an official academic registration, enrollment, or university decision system. You remain responsible for final course choices and academic eligibility checks.',
            ],
        },
        {
            heading: 'Account and security',
            body: [
                'You must use a valid email address from an Işık domain when creating an account. You are responsible for keeping your account information confidential.',
                'Misusing the system, attempting to access another account, or distributing share links without authorization is prohibited.',
            ],
        },
        {
            heading: 'Schedule data and accuracy',
            body: [
                'Schedule suggestions are generated from uploaded course data or the active semester data configured in the app. Source data may contain mistakes, omissions, or later changes.',
                'You should verify generated schedules against official university systems and department announcements.',
            ],
        },
        {
            heading: 'Share links',
            body: [
                'Share links let anyone with the link view the related schedule. You are responsible for controlling who receives those links.',
                'Shared schedules may reveal your course preferences, so use share links carefully.',
            ],
        },
        {
            heading: 'Changes and contact',
            body: [
                'App features and these terms may be updated over time. The goal is to inform users about material changes.',
                `For questions or requests, contact ${CONTACT_EMAILS.join(' or ')}.`,
            ],
        },
    ],
};
