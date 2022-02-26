function getRatelimit( envVar )
{
	return { max: Number( process.env[envVar] ) || ( Number( process.env.REQ_PER_MINUTE__GLOBAL ) || 9999 ) }
}

module.exports = {
	getRatelimit
}
