//TODO: подгрузка по согласованному JSON
const skills = ['Web', 'PR', 'Science'];

exports.skillsValue = code => {
  isCodeValid(code);

  const skill = skills[Number(code)];
  if (skill == undefined) return 'Unknown_skill';

  return skill;
};

function isCodeValid(code) {
  if (!(Number(code) <= skills.length && Number(code) >= 0))
    throw 'Invalid skill code!';
}

exports.isCodeValid = isCodeValid;
