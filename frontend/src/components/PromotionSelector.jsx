import { useState } from "react";

const PromotionSelector = ({ promotions, value, onChange,
    formData
}) => {
  const [selected, setSelected] = useState("");
  const [promoError, setPromoError] = useState('');

  const handleAdd = () => {
    if (!selected) return;
    const promo = promotions.find((p) => p.id === parseInt(selected));
    
    if (formData.type === "purchase") {
        if (!formData.spent) {
            setPromoError(`Please enter an amount first.`)
            return;
        }
        if (promo.minSpending && promo.minSpending > formData.spent) {
            setPromoError(`Minimum Spending amount is ${promo.minSpending}`)
            return;
        }
    }
    
    if (!value.includes(selected)) {
      onChange([...value, selected]);
    }
    setSelected("");
    setPromoError('');
  };

  const remove = (id) => {
    onChange(value.filter(x => x !== id));
  };

  return (
    <div className="form-group">
      <label>Add Promotion</label>

      <div className="promotion-selector-controls">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="promotion-select"
        >
          <option value="">Select promotion...</option>
          {promotions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button type="button" onClick={handleAdd} className="btn btn-primary promotion-add-btn">
          Add
        </button>
      </div>

      {value.length > 0 && (
        <div className="promotion-list">
          {value.map((id) => {
            const promo = promotions.find((p) => p.id === parseInt(id));
            return (
              <div key={id} className="promotion-item">
                <span className="promotion-name">{promo?.name || `#${id}`}</span>
                <button
                  type="button"
                  className="btn btn-secondary promotion-remove-btn"
                  onClick={() => remove(id)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
      {promoError && <div className="error-message">{promoError}</div>}

      <input
        type="hidden"
        name="promotionIds"
        value={JSON.stringify(value)}
      />
    </div>
  );
};

export default PromotionSelector;
