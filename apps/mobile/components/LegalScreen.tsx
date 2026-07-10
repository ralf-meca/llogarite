import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../lib/i18n';
import { colors } from '../lib/theme';

type LegalDocType = 'privacy' | 'terms';

type LegalScreenProps = {
  type: LegalDocType;
  onBack: () => void;
};

type Section = {
  heading: string;
  body: string;
};

const PRIVACY_SECTIONS_SQ: Section[] = [
  {
    heading: '1. Hyrje',
    body: 'Kjo Politikë Privatësie shpjegon si Llogarite mbledh, përdor dhe mbron të dhënat e tua kur përdor aplikacionin. Duke krijuar një llogari ose duke përdorur shërbimin, ti pranon praktikat e përshkruara këtu.',
  },
  {
    heading: '2. Të dhënat që mbledhim',
    body: 'Mbledhim: adresën e email-it dhe fjalëkalimin (të koduar, kurrë në tekst të thjeshtë); emrin dhe fotografinë e profilit nëse kyçesh me Google; të dhënat e faturave që ruan (shitësi, artikujt, çmimet, datat, kategoria); rezultatet e skanimit të kodit QR ose fotografisë së faturës; cilësimet e buxhetit dhe pagesave mujore; dhe lidhjet me shokë shpenzimesh që krijon brenda aplikacionit.',
  },
  {
    heading: '3. Si i përdorim të dhënat',
    body: 'Përdorim të dhënat për të ofruar funksionet kryesore të aplikacionit: ruajtjen dhe shfaqjen e faturave, llogaritjen e statistikave dhe buxhetit, ndarjen e shpenzimeve me shokët e tu, dërgimin e njoftimeve lokale për pagesat mujore, dhe verifikimin e faturave pranë sistemit qeveritar të fiskalizimit kur skanon një kod QR.',
  },
  {
    heading: '4. Ndarja e të dhënave',
    body: 'Nuk i shesim të dhënat e tua personale askujt. Identifikuesit e faturës (IIC, NIPT, data) dërgohen tek API-ja publike e verifikimit e autoritetit tatimor vetëm për të konfirmuar vlefshmërinë e faturës. Nëse përdor kyçjen me Google, disa të dhëna shkëmbehen me Google sipas politikës së tyre të privatësisë. Shokët e shpenzimeve që lidh me llogarinë tënde mund të shohin faturat që ndan me ta.',
  },
  {
    heading: '5. Ruajtja dhe siguria',
    body: 'Të dhënat ruhen në një bazë të dhënash të sigurt. Fjalëkalimet ruhen vetëm në formë të koduar (hash). Qasja në të dhënat e tua kërkon një sesion identifikimi (token) të vlefshëm.',
  },
  {
    heading: '6. Të drejtat e tua',
    body: 'Ke të drejtë të aksesosh, korrigjosh ose fshish të dhënat e tua në çdo kohë. Fshirja e llogarisë fshin në mënyrë të përhershme faturat, lidhjet me shokë, dhe cilësimet e lidhura me llogarinë tënde.',
  },
  {
    heading: '7. Përdoruesit e mitur',
    body: 'Llogarite nuk synohet për përdorues nën moshën 16 vjeç. Nëse mendon që një i mitur ka krijuar një llogari, na kontakto për ta fshirë.',
  },
  {
    heading: '8. Ndryshimet në këtë politikë',
    body: 'Kjo politikë mund të përditësohet herë pas here. Përdorimi i vazhdueshëm i aplikacionit pas një ndryshimi nënkupton pranimin e versionit të përditësuar.',
  },
  {
    heading: '9. Na kontakto',
    body: 'Për pyetje rreth kësaj politike ose të dhënave të tua, na shkruaj në support@llogarite.app.',
  },
];

const TERMS_SECTIONS_SQ: Section[] = [
  {
    heading: '1. Pranimi i kushteve',
    body: 'Duke krijuar një llogari ose duke përdorur Llogarite, ti pranon këto Kushte Përdorimi. Nëse nuk je dakord, mos e përdor aplikacionin.',
  },
  {
    heading: '2. Përshkrimi i shërbimit',
    body: 'Llogarite të ndihmon të skanosh, ruash dhe organizosh fatura e blerjeve, të ndjekësh buxhetin dhe pagesat mujore, dhe të ndash shpenzime të përbashkëta me shokë përmes aplikacionit.',
  },
  {
    heading: '3. Llogaria jote',
    body: 'Je përgjegjës për ruajtjen e kredencialeve të llogarisë tënde dhe për çdo veprim që kryhet nën të. Duhet të japësh të dhëna të sakta gjatë regjistrimit. Çdo person duhet të mbajë vetëm një llogari.',
  },
  {
    heading: '4. Përdorimi i pranueshëm',
    body: 'Nuk lejohet: përdorimi i aplikacionit për qëllime të paligjshme, përpjekja për të aksesuar të dhënat e përdoruesve të tjerë pa autorizim, ose përpjekja për të keqpërdorur integrimin me sistemin e verifikimit të faturave.',
  },
  {
    heading: '5. Përmbajtja jote',
    body: 'Ti mban pronësinë e të dhënave dhe faturave që shton në aplikacion. Na jep të drejtën ta përpunojmë këtë përmbajtje vetëm për të ofruar shërbimin (p.sh. ruajtje, llogaritje statistikash, ndarje me shokë sipas zgjedhjes tënde).',
  },
  {
    heading: '6. Shokët e shpenzimeve',
    body: 'Kur lidhesh me një përdorues tjetër dhe ndan një faturë me të, të dyja llogaritë mund të shohin detajet e shpenzimit të ndarë. Je vetë përgjegjës për personat me të cilët lidhesh.',
  },
  {
    heading: '7. Kufizimi i përgjegjësisë',
    body: 'Aplikacioni ofrohet "siç është". Nuk garantojmë saktësi absolute për të dhënat e nxjerra nga skanimi (OCR) apo rezultatet e verifikimit nga sisteme të palëve të treta — kontrollo gjithmonë shifrat e rëndësishme financiare vetë.',
  },
  {
    heading: '8. Ndërprerja',
    body: 'Mund ta fshish llogarinë tënde në çdo moment nga aplikacioni. Ne mund të pezullojmë ose ndërpresim llogaritë që shkelin këto kushte.',
  },
  {
    heading: '9. Ndryshimet në shërbim',
    body: 'Funksionalitetet e aplikacionit mund të ndryshojnë, shtohen ose hiqen me kalimin e kohës. Këto kushte gjithashtu mund të përditësohen; do të vazhdojmë t\'i mbajmë të qarta dhe të arsyeshme.',
  },
  {
    heading: '10. Ligji në fuqi',
    body: 'Këto kushte rregullohen nga ligjet në fuqi në vendin tënd të banimit, përveç rasteve kur kërkohet ndryshe nga ligji.',
  },
  {
    heading: '11. Na kontakto',
    body: 'Për pyetje rreth këtyre kushteve, na shkruaj në support@llogarite.app.',
  },
];

const PRIVACY_SECTIONS_EN: Section[] = [
  {
    heading: '1. Introduction',
    body: 'This Privacy Policy explains how Llogarite collects, uses, and protects your data when you use the app. By creating an account or using the service, you accept the practices described here.',
  },
  {
    heading: '2. Data we collect',
    body: 'We collect: your email address and password (encrypted, never stored in plain text); your name and profile photo if you sign in with Google; the invoice data you save (seller, items, prices, dates, category); results from scanning a QR code or invoice photo; your budget and monthly payment settings; and expense-buddy connections you create within the app.',
  },
  {
    heading: '3. How we use your data',
    body: 'We use your data to provide the core features of the app: saving and displaying invoices, calculating statistics and budget, splitting expenses with your buddies, sending local reminders for monthly payments, and verifying invoices with the government invoicing system when you scan a QR code.',
  },
  {
    heading: '4. Data sharing',
    body: "We do not sell your personal data to anyone. Invoice identifiers (IIC, tax ID, date) are sent to the tax authority's public verification API only to confirm the invoice's validity. If you use Google sign-in, some data is exchanged with Google under their own privacy policy. Expense buddies you connect with can see the invoices you share with them.",
  },
  {
    heading: '5. Storage and security',
    body: 'Data is stored in a secured database. Passwords are stored only in encrypted (hashed) form. Access to your data requires a valid authentication session (token).',
  },
  {
    heading: '6. Your rights',
    body: 'You have the right to access, correct, or delete your data at any time. Deleting your account permanently removes your invoices, buddy connections, and account-related settings.',
  },
  {
    heading: '7. Minors',
    body: "Llogarite is not intended for users under the age of 16. If you believe a minor has created an account, contact us so we can delete it.",
  },
  {
    heading: '8. Changes to this policy',
    body: 'This policy may be updated from time to time. Continued use of the app after a change means you accept the updated version.',
  },
  {
    heading: '9. Contact us',
    body: 'For questions about this policy or your data, write to us at support@llogarite.app.',
  },
];

const TERMS_SECTIONS_EN: Section[] = [
  {
    heading: '1. Acceptance of terms',
    body: 'By creating an account or using Llogarite, you accept these Terms of Service. If you do not agree, do not use the app.',
  },
  {
    heading: '2. Service description',
    body: 'Llogarite helps you scan, save, and organize purchase invoices, track your budget and monthly payments, and split shared expenses with buddies through the app.',
  },
  {
    heading: '3. Your account',
    body: 'You are responsible for keeping your account credentials secure and for any activity carried out under it. You must provide accurate information when registering. Each person should keep only one account.',
  },
  {
    heading: '4. Acceptable use',
    body: 'Not allowed: using the app for unlawful purposes, attempting to access other users’ data without authorization, or attempting to misuse the integration with the invoice verification system.',
  },
  {
    heading: '5. Your content',
    body: 'You retain ownership of the data and invoices you add to the app. You grant us the right to process this content solely to provide the service (e.g. storage, statistics calculation, sharing with buddies as you choose).',
  },
  {
    heading: '6. Expense buddies',
    body: 'When you connect with another user and share an invoice with them, both accounts can see the shared expense details. You are responsible for the people you connect with.',
  },
  {
    heading: '7. Limitation of liability',
    body: 'The app is provided "as is". We do not guarantee absolute accuracy for data extracted via scanning (OCR) or verification results from third-party systems — always double-check important financial figures yourself.',
  },
  {
    heading: '8. Termination',
    body: 'You may delete your account at any time from the app. We may suspend or terminate accounts that violate these terms.',
  },
  {
    heading: '9. Changes to the service',
    body: "The app's features may change, be added, or be removed over time. These terms may also be updated; we will keep them clear and reasonable.",
  },
  {
    heading: '10. Governing law',
    body: 'These terms are governed by the laws applicable in your country of residence, except where the law requires otherwise.',
  },
  {
    heading: '11. Contact us',
    body: 'For questions about these terms, write to us at support@llogarite.app.',
  },
];

export function LegalScreen({ type, onBack }: LegalScreenProps) {
  const { t, language } = useTranslation();
  const sections =
    language === 'en'
      ? type === 'privacy'
        ? PRIVACY_SECTIONS_EN
        : TERMS_SECTIONS_EN
      : type === 'privacy'
        ? PRIVACY_SECTIONS_SQ
        : TERMS_SECTIONS_SQ;
  const title = type === 'privacy' ? t('legal.privacyTitle') : t('legal.termsTitle');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.updatedText}>{t('legal.lastUpdated')}</Text>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 24,
    marginTop: 8,
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
  },
  scroll: {
    flex: 1,
    marginTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    gap: 20,
  },
  updatedText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  section: {
    gap: 6,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textDark,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
});
