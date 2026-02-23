import { Navigate, useSearchParams } from "react-router-dom";

const LandingPageObrigado = () => {
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const target = `/cadastro/obrigado${queryString ? '?' + queryString : ''}`;
  return <Navigate to={target} replace />;
};

export default LandingPageObrigado;
