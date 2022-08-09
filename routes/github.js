const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.send("hi!");
});

const PR_STATUS = {
  APPROVED: "APPROVED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  NO_REVIEWS: "NO_REVIEWS",
};

const USER_ASSOCIATION = {
  MEMBER: "MEMBER",
  CONTRIBUTOR: "CONTRIBUTOR",
};

function isAssociated(association) {
  return (
    association === USER_ASSOCIATION.MEMBER ||
    association === USER_ASSOCIATION.CONTRIBUTOR
  );
}

// GET Approval status for PR
router.get("/repos/:user/:repo/pulls/:pr/reviews/status", async (req, res) => {
  const { user, repo, pr } = req.params;
  let dataResponse;

  dataResponse = await fetch(
    `https://api.github.com/repos/${user}/${repo}/pulls/${pr}`
  );
  if (!dataResponse.ok)
    return res.send(`Error from github api: ${await dataResponse.json()}`);

  const {
    user: { id: prAuthor },
    author_association: prAuthorAssociation,
  } = await dataResponse.json();

  if (isAssociated(prAuthorAssociation)) {
    return res.send(PR_STATUS.APPROVED);
  }

  dataResponse = await fetch(
    `https://api.github.com/repos/${user}/${repo}/pulls/${pr}/reviews`
  );
  if (!dataResponse.ok)
    return res.send(`Error from github api: ${await dataResponse.json()}`);

  const body = await dataResponse.json();

  const userReviews = {};
  const reviews = body
    .map((r) => ({
      user: r.user.id,
      association: r.author_association,
      state: r.state,
    }))
    .filter(
      (r) =>
        r.user !== prAuthor &&
        isAssociated(r.association) &&
        (r.state === PR_STATUS.APPROVED ||
          r.state === PR_STATUS.CHANGES_REQUESTED)
    );

  if (reviews.length < 1) {
    return res.send(PR_STATUS.NO_REVIEWS);
  }

  for (const review of reviews) {
    userReviews[review.user] = review.state;
  }

  for (const userReview of Object.values(userReviews)) {
    if (userReview === PR_STATUS.CHANGES_REQUESTED)
      return res.send(PR_STATUS.CHANGES_REQUESTED);
  }

  return res.send(PR_STATUS.APPROVED);
});

module.exports = router;
