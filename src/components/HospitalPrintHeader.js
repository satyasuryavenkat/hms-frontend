import { HospitalLogo } from './HospitalLogo';

export function HospitalPrintHeader() {
  return (
    <header className="receipt-hospital-header">
      <div className="receipt-brand">
        <HospitalLogo className="receipt-logo"/>
        <div>
          <h1>
            <span>Lakshmi Sreenivaasa</span>
            <span>Multi Speciality Hospital</span>
          </h1>
          <p>Healing · Caring · Serving</p>
        </div>
      </div>
      <address className="hospital-print-contact">
        <span className="hospital-contact-address">Opposite to Government Hospital<br/>Main Road, Nagarkurnool</span>
        <span className="hospital-contact-line"><strong>Call:</strong><span>9494949986&nbsp;&nbsp;|&nbsp;&nbsp;8441791919</span></span>
        <span className="hospital-contact-line email-line"><strong>Email:</strong><span>lakshmisreenivaasahospitals@gmail.com</span></span>
      </address>
    </header>
  );
}
