// Create transaction page
import CashierCreateTx from '../components/CashierCreateTx';
import UserCreateTx from '../components/UserCreateTx';
import { useAuth } from '../contexts/AuthContext';

const CreateTransaction = () => {
  const { hasRole } = useAuth();
  
  return (
    hasRole('cashier') ? <CashierCreateTx/> : <UserCreateTx/>
  )
};

export default CreateTransaction;

