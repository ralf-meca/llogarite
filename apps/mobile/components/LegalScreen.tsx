import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const PRIVACY_SECTIONS: Section[] = [
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

const TERMS_SECTIONS: Section[] = [
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

const TITLES: Record<LegalDocType, string> = {
  privacy: 'Politika e Privatësisë',
  terms: 'Kushtet e Përdorimit',
};

export function LegalScreen({ type, onBack }: LegalScreenProps) {
  const sections = type === 'privacy' ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.textDark} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {TITLES[type]}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.updatedText}>Përditësuar për herë të fundit: korrik 2026</Text>
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
