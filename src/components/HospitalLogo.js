import logo from '../assets/hms-symbol.png';

export const HOSPITAL_NAME = 'Lakshmi Sreenivaasa Multi Speciality Hospital';
export const HOSPITAL_SHORT_NAME = 'Lakshmi Sreenivaasa';

export function HospitalLogo({ className = '', alt = HOSPITAL_NAME }) {
  return <img className={`hospital-logo ${className}`.trim()} src={logo} alt={alt}/>;
}
