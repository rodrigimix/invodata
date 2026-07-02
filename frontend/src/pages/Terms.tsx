import { useTranslation } from "react-i18next";

const Terms = () => {
  const { t } = useTranslation();
  const contactEmail = "rodrigimix56@gmail.com";
  const updatedDate = t("terms.updatedDate");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">{t("terms.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("terms.updated", { date: updatedDate })}
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section1Title")}</h2>
          <p>{t("terms.section1Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section2Title")}</h2>
          <p>{t("terms.section2Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section3Title")}</h2>
          <p>{t("terms.section3Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section4Title")}</h2>
          <p>{t("terms.section4Body")}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("terms.section4Item1")}</li>
            <li>{t("terms.section4Item2")}</li>
            <li>{t("terms.section4Item3")}</li>
            <li>{t("terms.section4Item4")}</li>
            <li>{t("terms.section4Item5")}</li>
            <li>{t("terms.section4Item6")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section5Title")}</h2>
          <p>{t("terms.section5Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section6Title")}</h2>
          <p>{t("terms.section6Body")}</p>
          <p>{t("terms.section6Body2")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section7Title")}</h2>
          <p>{t("terms.section7Body")}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("terms.section7Item1")}</li>
            <li>{t("terms.section7Item2")}</li>
            <li>{t("terms.section7Item3")}</li>
            <li>{t("terms.section7Item4")}</li>
            <li>{t("terms.section7Item5")}</li>
            <li>{t("terms.section7Item6")}</li>
          </ul>
          <p>{t("terms.section7Contact", { email: contactEmail })}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section8Title")}</h2>
          <p>{t("terms.section8Body")}</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>{t("terms.section8Item1")}</li>
            <li>{t("terms.section8Item2")}</li>
            <li>{t("terms.section8Item3")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section9Title")}</h2>
          <p>{t("terms.section9Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section10Title")}</h2>
          <p>{t("terms.section10Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section11Title")}</h2>
          <p>{t("terms.section11Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section12Title")}</h2>
          <p>{t("terms.section12Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section13Title")}</h2>
          <p>{t("terms.section13Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section14Title")}</h2>
          <p>{t("terms.section14Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section15Title")}</h2>
          <p>{t("terms.section15Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section16Title")}</h2>
          <p>{t("terms.section16Body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section17Title")}</h2>
          <p>{t("terms.section17Body", { email: contactEmail })}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("terms.section18Title")}</h2>
          <p>{t("terms.section18Body")}</p>
        </section>
      </div>
    </div>
  );
};

export default Terms;
