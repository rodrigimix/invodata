import { useTranslation } from "react-i18next";

const Privacy = () => {
  const { t } = useTranslation();
  const contactEmail = "rodrigimix56@gmail.com";
  const updatedDate = t("privacy.updatedDate");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("privacy.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("privacy.updated", { date: updatedDate })}
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("privacy.section1Title")}</h2>
          <p>{t("privacy.section1Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("privacy.section2Title")}</h2>
          <p>{t("privacy.section2Body")}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("privacy.section2Item1")}</li>
            <li>{t("privacy.section2Item2")}</li>
            <li>{t("privacy.section2Item3")}</li>
            <li>{t("privacy.section2Item4")}</li>
            <li>{t("privacy.section2Item5")}</li>
            <li>{t("privacy.section2Item6")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("privacy.section3Title")}</h2>
          <p>{t("privacy.section3Body")}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("privacy.section3Item1")}</li>
            <li>{t("privacy.section3Item2")}</li>
            <li>{t("privacy.section3Item3")}</li>
            <li>{t("privacy.section3Item4")}</li>
            <li>{t("privacy.section3Item5")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("privacy.section4Title")}</h2>
          <p>{t("privacy.section4Body")}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("privacy.section4Item1")}</li>
            <li>{t("privacy.section4Item2")}</li>
            <li>{t("privacy.section4Item3")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("privacy.section5Title")}</h2>
          <p>{t("privacy.section5Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("privacy.section7Title")}</h2>
          <p>{t("privacy.section7Body")}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("privacy.section7Item1")}</li>
            <li>{t("privacy.section7Item2")}</li>
            <li>{t("privacy.section7Item3")}</li>
            <li>{t("privacy.section7Item4")}</li>
            <li>{t("privacy.section7Item5")}</li>
            <li>{t("privacy.section7Item6")}</li>
          </ul>
          <p>{t("privacy.section7Process", { email: contactEmail })}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("privacy.section9Title")}</h2>
          <p>{t("privacy.section9Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("privacy.section10Title")}</h2>
          <p>{t("privacy.section10Body", { email: contactEmail })}</p>
        </section>
      </div>
    </div>
  );
};

export default Privacy;
